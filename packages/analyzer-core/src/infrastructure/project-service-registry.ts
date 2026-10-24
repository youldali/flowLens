import * as path from 'node:path';
import { stat } from 'node:fs/promises';
import type { ParsedCommandLine, Program, Project, Snapshot } from 'typescript-native/async';
import { excludedDirectories, findTsConfigPaths, isWithinDirectory } from '@flowlens/common/fs';
import { NativeLanguageServer } from './native-language-server.js';

export interface ProjectService {
  projectConfig: { configPath: string; parsed: ParsedCommandLine };
  server: NativeLanguageServer;
  snapshot: Snapshot;
  project: Project;
  program: Program;
}

type ConfigPath = string;

/** Owns one repository's native server and immutable snapshots until clear(). */
export class ProjectServiceRegistry {
  readonly root: string;
  private server: NativeLanguageServer | undefined;
  private readonly services = new Map<ConfigPath, ProjectService>();
  private discovered = false;
  private pending: Promise<void> = Promise.resolve();

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  getService(tsconfigPath: string): Promise<ProjectService> {
    return this.serialize(() => {
      const configPath = path.resolve(tsconfigPath);

      if (!isWithinDirectory(this.root, configPath)) {
        throw new Error(`Configuration ${configPath} is outside repository ${this.root}`);
      }

      return this.loadService(configPath);
    });
  }

  getProjectServices(): Promise<readonly ProjectService[]> {
    return this.serialize(async () => {
      if (!this.discovered) {
        const configs = await this.discoverConfigs(this.root, await this.getServer());

        for (const config of configs) {
          if (config.parsed.fileNames.length) await this.loadService(config.configPath, config.parsed);
        }

        this.discovered = true;
      }

      return [...this.services.values()].sort((a, b) => a.projectConfig.configPath.localeCompare(b.projectConfig.configPath));
    });
  }

  clear(): Promise<void> {
    return this.serialize(async () => {
      const services = [...this.services.values()];
      const server = this.server;
      this.services.clear();
      this.server = undefined;
      this.discovered = false;
      const results = await Promise.allSettled(services.map(service => service.snapshot.dispose()));
      const failures: unknown[] = results.filter(result => result.status === 'rejected').map(result => result.reason);

      try {
        await server?.dispose();
      } catch (error) {
        failures.push(error);
      }

      if (failures.length) throw new AggregateError(failures, `Failed to clear native project registry for ${this.root}`);
    });
  }

  private async getServer(): Promise<NativeLanguageServer> {
    this.server ??= await NativeLanguageServer.create(this.root);
    return this.server;
  }

  private async loadService(configPath: string, parsed?: ParsedCommandLine): Promise<ProjectService> {
    const existing = this.services.get(configPath);
    if (existing) return existing;
    let snapshot: Snapshot | undefined;

    try {
      const server = await this.getServer();
      const config = parsed ?? await server.parseConfig(configPath);
      snapshot = await server.getSnapshot({ openProjects: [configPath], ensurePrograms: true });
      const project = snapshot.getConfiguredProject(configPath);
      if (!project) throw new Error(`Native compiler did not load configured project ${configPath}`);
      const service = { projectConfig: { configPath, parsed: config }, server, snapshot, project, program: project.program };
      this.services.set(configPath, service);
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
