import * as path from 'node:path';
import type { Project, Snapshot } from 'typescript-native/async';
import { collectWorkspaceTsConfigs, isWithinDirectory, type FilePath } from '@flowlens/common/fs';
import { err, ok, type Result } from 'neverthrow';
import { InvalidTypeScriptConfigError, NativeLanguageServer } from '#infrastructure/native-language-server';

export type ProjectNotFoundError = { reason: 'project-not-found'; filePath: FilePath };

export type CompilationError =
  | { reason: 'tsconfig-not-found' }
  | { reason: 'config-outside-workspace'; configPath: FilePath }
  | { reason: 'config-not-in-snapshot'; configPath: FilePath }
  | { reason: 'invalid-config'; configPath: FilePath; cause: InvalidTypeScriptConfigError };

/** Owns one analysis's native server and shared snapshot. Its owner sequences access before clear(). */
export class TypeScriptCompilationRegistry {
  private clearing: Promise<void> | undefined;

  static async create(root: FilePath): Promise<Result<TypeScriptCompilationRegistry, CompilationError>> {
    const workspaceRoot = path.resolve(root);
    const nativeLanguageServer = await NativeLanguageServer.create(workspaceRoot);
    let snapshot: Snapshot | undefined;
    let initialized = false;
    let initializationFailure: unknown;

    try {
      const configPaths: FilePath[] = [];

      for (const configPath of collectWorkspaceTsConfigs(workspaceRoot)) {
        try {
          const parsedConfig = await nativeLanguageServer.parseConfig(configPath);
          if (parsedConfig.fileNames.length) configPaths.push(configPath);
        } catch (error) {
          if (error instanceof InvalidTypeScriptConfigError) {
            const configError = { reason: 'invalid-config', configPath, cause: error } as const;
            initializationFailure = configError;
            return err(configError);
          }

          throw new Error(`Failed to parse native workspace project ${configPath}`, { cause: error });
        }
      }

      if (!configPaths.length) {
        const configError = { reason: 'tsconfig-not-found' } as const;
        initializationFailure = configError;
        return err(configError);
      }

      const acquiredSnapshot = await nativeLanguageServer.getSnapshot({ openProjects: configPaths, ensurePrograms: true });
      snapshot = acquiredSnapshot;
      const projects = new Map(configPaths.map(configPath => {
        const project = acquiredSnapshot.getConfiguredProject(configPath);
        if (!project?.configFileName || path.resolve(project.configFileName) !== configPath) throw new Error(`Native compiler did not load configured project ${configPath}`);
        return [configPath, project] as const;
      }));
      const registry = new TypeScriptCompilationRegistry(workspaceRoot, nativeLanguageServer, acquiredSnapshot, projects);
      initialized = true;
      return ok(registry);
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

  async getProject(tsconfigPath: FilePath): Promise<Result<Project, CompilationError>> {
    this.ensureOpen();

    const configPath = path.resolve(tsconfigPath);
    if (!isWithinDirectory(this.root, configPath)) {
      return err({ reason: 'config-outside-workspace', configPath });
    }

    const project = this.compilations.get(configPath);
    return project ? ok(project) : err({ reason: 'config-not-in-snapshot', configPath });
  }

  async getProjectForFile(filePath: FilePath): Promise<Result<Project, ProjectNotFoundError>> {
    this.ensureOpen();

    const resolvedFilePath = path.resolve(filePath);
    if (!isWithinDirectory(this.root, resolvedFilePath)) return err({ reason: 'project-not-found', filePath: resolvedFilePath });
    const project = await this.snapshot.getDefaultProjectForFile(resolvedFilePath);
    return project?.configFileName && this.compilations.get(path.resolve(project.configFileName)) === project
      ? ok(project)
      : err({ reason: 'project-not-found', filePath: resolvedFilePath });
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
