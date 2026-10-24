import * as path from 'node:path';
import { stat } from 'node:fs/promises';
import type { ParsedCommandLine, Program, Project, Snapshot } from 'typescript-native/async';
import { excludedDirectories, findTsConfigPaths, findWorkspaceRoot, isWithinDirectory } from '@flowlens/common/fs';
import { NativeLanguageServer } from './native-language-server.js';

export interface ProjectService {
  projectConfig: { configPath: string; parsed: ParsedCommandLine };
  server: NativeLanguageServer;
  snapshot: Snapshot;
  project: Project;
  program: Program;
}

type WorkspaceRoot = string;
type ConfigPath = string;
interface WorkspaceSession {
  server: NativeLanguageServer;
  services: Map<ConfigPath, ProjectService>;
  discovered: boolean;
}

/** Owns native workspace servers and immutable project snapshots until clear(). */
export class ProjectServiceRegistry {
  private static readonly instance = new ProjectServiceRegistry();
  private readonly workspaces = new Map<WorkspaceRoot, WorkspaceSession>();
  private pending: Promise<void> = Promise.resolve();

  private constructor() {}

  static getInstance(): ProjectServiceRegistry {
    return this.instance;
  }

  getService(tsconfigPath: string): Promise<ProjectService> {
    return this.serialize(async () => {
      const configPath = path.resolve(tsconfigPath);
      const workspace = await this.getWorkspace(findWorkspaceRoot(configPath));
      return this.loadService(workspace, configPath);
    });
  }

  getProjectServices(tsconfigPath: string): Promise<readonly ProjectService[]> {
    return this.serialize(async () => {
      const root = findWorkspaceRoot(path.resolve(tsconfigPath));
      const workspace = await this.getWorkspace(root);

      if (!workspace.discovered) {
        const configs = await this.discoverConfigs(root, workspace.server);

        for (const config of configs) {
          if (config.parsed.fileNames.length) await this.loadService(workspace, config.configPath, config.parsed);
        }

        workspace.discovered = true;
      }

      return [...workspace.services.values()].sort((a, b) => a.projectConfig.configPath.localeCompare(b.projectConfig.configPath));
    });
  }

  clear(): Promise<void> {
    return this.serialize(async () => {
      const workspaces = [...this.workspaces.values()];
      this.workspaces.clear();
      const results = await Promise.allSettled(workspaces.map(async workspace => {
        try {
          const results = await Promise.allSettled([...workspace.services.values()].map(service => service.snapshot.dispose()));
          const failures = results.filter(result => result.status === 'rejected');
          if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Failed to dispose native snapshots');
        } finally {
          await workspace.server.dispose();
        }
      }));
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Failed to clear native project registry');
    });
  }

  private async getWorkspace(root: string): Promise<WorkspaceSession> {
    const existing = this.workspaces.get(root);
    if (existing) return existing;
    const workspace = { server: await NativeLanguageServer.create(root), services: new Map<ConfigPath, ProjectService>(), discovered: false };
    this.workspaces.set(root, workspace);
    return workspace;
  }

  private async loadService(workspace: WorkspaceSession, configPath: string, parsed?: ParsedCommandLine): Promise<ProjectService> {
    const existing = workspace.services.get(configPath);
    if (existing) return existing;
    let snapshot: Snapshot | undefined;

    try {
      const config = parsed ?? await workspace.server.parseConfig(configPath);
      snapshot = await workspace.server.getSnapshot({ openProjects: [configPath], ensurePrograms: true });
      const project = snapshot.getConfiguredProject(configPath);
      if (!project) throw new Error(`Native compiler did not load configured project ${configPath}`);
      const service = { projectConfig: { configPath, parsed: config }, server: workspace.server, snapshot, project, program: project.program };
      workspace.services.set(configPath, service);
      return service;
    } catch (error) {
      await snapshot?.dispose();
      throw new Error(`FlowLens: failed to create native project service for ${configPath}`, { cause: error });
    }
  }

  private async discoverConfigs(root: string, server: NativeLanguageServer) {
    const configs: ProjectService['projectConfig'][] = [];
    const candidates = findTsConfigPaths(root);
    const visited = new Set<ConfigPath>();
    const outputDirectories = new Set<string>();
    const isOutput = (file: string) => [...outputDirectories].some(output => isWithinDirectory(output, file));

    for (const candidate of candidates) {
      const configPath = path.resolve(candidate);
      if (visited.has(configPath) || !isWithinDirectory(root, configPath) || isOutput(configPath)) continue;
      visited.add(configPath);

      try {
        const parsed = await server.parseConfig(configPath);
        configs.push({ configPath, parsed });

        for (const output of [parsed.options.outDir, parsed.options.declarationDir]) {
          if (output) outputDirectories.add(path.resolve(output));
        }

        for (const reference of parsed.projectReferences ?? []) {
          const referencePath = path.resolve(reference.path);
          if (path.relative(root, referencePath).split(path.sep).some(part => excludedDirectories.has(part))) continue;
          const resolved = (await stat(referencePath)).isDirectory() ? path.join(referencePath, 'tsconfig.json') : referencePath;
          candidates.push(resolved);
        }
      } catch (error) {
        throw new Error(`Failed to discover native workspace project ${configPath}`, { cause: error });
      }
    }

    return configs.filter(config => !isOutput(config.configPath));
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    // Return the original rejection to the caller, while allowing later operations to retry.
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }
}
