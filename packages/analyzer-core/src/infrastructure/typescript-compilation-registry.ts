import * as path from 'node:path';
import type { Project, Snapshot } from 'typescript-native/async';
import { collectWorkspaceTsConfigs, isWithinDirectory, type FilePath } from '@flowlens/common/fs';
import { err, ok, type Result } from 'neverthrow';
import { ResultFlow } from '@youldali/result-flow';
import { InvalidTypeScriptConfigError, NativeLanguageServer } from '#infrastructure/native-language-server';

const excludedTsconfigFileNamePattern = /^tsconfig\.test\.json$/;

export type ProjectNotFoundError = { reason: 'project-not-found'; filePath: FilePath };

export type CompilationError =
  | { reason: 'tsconfig-not-found' }
  | { reason: 'config-outside-workspace'; configPath: FilePath }
  | { reason: 'config-not-in-snapshot'; configPath: FilePath }
  | { reason: 'invalid-config'; configPath: FilePath; cause: InvalidTypeScriptConfigError };

/** Owns one analysis's native server and shared snapshot. Its owner sequences access before clear(). */
export class TypeScriptCompilationRegistry {
  private clearing: Promise<void> | undefined;

  static create(root: FilePath): ResultFlow<TypeScriptCompilationRegistry, CompilationError> {
    return ResultFlow.gen<TypeScriptCompilationRegistry, CompilationError>(async function* () {
      const workspaceRoot = path.resolve(root);
      const nativeLanguageServer = await NativeLanguageServer.create(workspaceRoot);
      let snapshot: Snapshot | undefined;
      let initialized = false;
      let initializationFailure: unknown;
      let initializationResult: Result<TypeScriptCompilationRegistry, CompilationError>;

      try {
        initializationResult = await ResultFlow.gen<TypeScriptCompilationRegistry, CompilationError>(async function* ({ fail }) {
          const configPaths: FilePath[] = [];

          for (const configPath of collectWorkspaceTsConfigs(workspaceRoot, { excludeFileNamePattern: excludedTsconfigFileNamePattern })) {
            try {
              const parsedConfig = await nativeLanguageServer.parseConfig(configPath);
              if (parsedConfig.fileNames.length) configPaths.push(configPath);
            } catch (error) {
              if (error instanceof InvalidTypeScriptConfigError) {
                return fail({ reason: 'invalid-config', configPath, cause: error });
              }

              throw new Error(`Failed to parse native workspace project ${configPath}`, { cause: error });
            }
          }

          if (!configPaths.length) return fail({ reason: 'tsconfig-not-found' });

          const acquiredSnapshot = await nativeLanguageServer.getSnapshot({ openProjects: configPaths, ensurePrograms: true });
          snapshot = acquiredSnapshot;
          const projects = new Map(configPaths.map(configPath => {
            const project = acquiredSnapshot.getConfiguredProject(configPath);
            if (!project?.configFileName || path.resolve(project.configFileName) !== configPath) throw new Error(`Native compiler did not load configured project ${configPath}`);
            return [configPath, project] as const;
          }));
          return new TypeScriptCompilationRegistry(workspaceRoot, nativeLanguageServer, acquiredSnapshot, projects);
        }).run();
        initialized = initializationResult.isOk();
        if (initializationResult.isErr()) initializationFailure = initializationResult.error;
      } catch (error) {
        initializationFailure = new Error(`Failed to initialize compilation registry for ${workspaceRoot}`, { cause: error });
        throw initializationFailure;
      } finally {
        if (!initialized) {
          const cleanupFailures: unknown[] = [];

          try {
            await snapshot?.dispose();
          } catch (error) {
            cleanupFailures.push(error);
          }

          try {
            await nativeLanguageServer.dispose();
          } catch (error) {
            cleanupFailures.push(error);
          }

          if (cleanupFailures.length) throw new AggregateError([initializationFailure, ...cleanupFailures], 'Registry initialization and cleanup failed');
        }
      }

      return yield* initializationResult;
    });
  }

  private constructor(
    readonly root: FilePath,
    private readonly nativeLanguageServer: NativeLanguageServer,
    private readonly snapshot: Snapshot,
    private readonly compilations: Map<FilePath, Project>,
  ) {}

  async getServer(): Promise<NativeLanguageServer> {
    this.ensureOpen();
    return this.nativeLanguageServer;
  }

  getProject(tsconfigPath: FilePath): Result<Project, CompilationError> {
    this.ensureOpen();

    const configPath = path.resolve(tsconfigPath);
    if (!isWithinDirectory(this.root, configPath)) {
      return err({ reason: 'config-outside-workspace', configPath });
    }

    const project = this.compilations.get(configPath);
    return project ? ok(project) : err({ reason: 'config-not-in-snapshot', configPath });
  }

  getProjectForFile(filePath: FilePath): ResultFlow<Project, ProjectNotFoundError> {
    const registry = this;
    return ResultFlow.gen<Project, ProjectNotFoundError>(async function* ({ fail }) {
      registry.ensureOpen();

      const resolvedFilePath = path.resolve(filePath);
      if (!isWithinDirectory(registry.root, resolvedFilePath)) return fail({ reason: 'project-not-found', filePath: resolvedFilePath });
      const project = await registry.snapshot.getDefaultProjectForFile(resolvedFilePath);
      if (!project?.configFileName || registry.compilations.get(path.resolve(project.configFileName)) !== project) {
        return fail({ reason: 'project-not-found', filePath: resolvedFilePath });
      }

      return project;
    });
  }

  async getProjects(): Promise<readonly Project[]> {
    this.ensureOpen();

    return [...this.compilations.entries()].sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
      .map(([, project]) => project);
  }

  /** Terminal cleanup; the owner must finish all resource access before calling this. */
  clear(): Promise<void> {
    this.clearing ??= Promise.resolve().then(() => this.clearResources());
    return this.clearing;
  }

  private async clearResources(): Promise<void> {
    this.compilations.clear();

    const disposalFailures: unknown[] = [];

    try {
      await this.snapshot.dispose();
    } catch (error) {
      disposalFailures.push(error);
    }

    try {
      await this.nativeLanguageServer.dispose();
    } catch (error) {
      disposalFailures.push(error);
    }

    if (disposalFailures.length) throw new AggregateError(disposalFailures, `Failed to clear TypeScript compilation registry for ${this.root}`);
  }

  private ensureOpen(): void {
    if (this.clearing) throw new Error('TypeScript compilation registry is cleared');
  }
}
