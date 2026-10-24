import * as path from 'node:path';
import * as ts from 'typescript';
import { loadProjectConfig, type ConfigPath, type ProjectConfig } from './project-config.js';
import { isWithinDirectory } from '@flowlens/common/fs';
import { discoverWorkspaceProjects } from './workspace-projects.js';

export interface ProjectService {
  projectConfig: ProjectConfig;
  languageService: ts.LanguageService;
  program: ts.Program;
}

export class LegacyProjectServiceRegistry {
  readonly root: string;
  private readonly projectServices = new Map<ConfigPath, ProjectService>();
  private discovered = false;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  getService(tsconfigPath: string): ProjectService {
    const configPath = path.resolve(tsconfigPath);

    if (!isWithinDirectory(this.root, configPath)) {
      throw new Error(`Configuration ${configPath} is outside repository ${this.root}`);
    }

    return this.projectServices.getOrInsertComputed(configPath, () => createProjectService(loadProjectConfig(configPath)));
  }

  *getProjectServices(): Generator<ProjectService> {
    this.discoverProjectServices();
    yield* [...this.projectServices.values()]
      .sort((a, b) => a.projectConfig.configPath.localeCompare(b.projectConfig.configPath));
  }

  clear(): void {
    const services = [...this.projectServices.values()];
    const failures: unknown[] = [];
    this.projectServices.clear();
    this.discovered = false;

    for (const service of services) {
      try {
        service.languageService.dispose();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length) throw new AggregateError(failures, `Failed to clear legacy project registry for ${this.root}`);
  }

  private discoverProjectServices(): void {
    if (this.discovered) return;
    discoverWorkspaceProjects(this.root).forEach(config => this.resolveService(config));
    this.discovered = true;
  }

  private resolveService(config: ProjectConfig): ProjectService | undefined {
    const configPath = path.resolve(config.configPath);
    return this.projectServices.get(configPath) ?? (
      config.parsed.fileNames.length > 0
        ? this.createService(config)
        : undefined
    );
  }

  private createService(config: ProjectConfig): ProjectService {
    const configPath = path.resolve(config.configPath);
    try {
      const service = createProjectService(config);
      this.projectServices.set(configPath, service);
      return service;
    } catch (error) {
      throw new Error(`FlowLens: failed to create project service for ${config.configPath}`, { cause: error });
    }
  }
}

function createProjectService(config: ProjectConfig): ProjectService {
  // TypeScript's language service forwards this compiler-host hook, although its
  // public LanguageServiceHost type does not expose it.
  const host: ts.LanguageServiceHost & { useSourceOfProjectReferenceRedirect(): boolean } = {
    useSourceOfProjectReferenceRedirect: () => true,
    getScriptFileNames: () => config.parsed.fileNames,
    getScriptVersion: () => '0',
    getScriptSnapshot: (fileName) => {
      const content = ts.sys.readFile(fileName);
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => path.dirname(config.configPath),
    getCompilationSettings: () => config.parsed.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    getProjectReferences: () => config.parsed.projectReferences,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    ...(ts.sys.realpath ? { realpath: ts.sys.realpath } : {}),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };
  const languageService = ts.createLanguageService(host);
  const program = languageService.getProgram();
  if (!program) {
    languageService.dispose();
    throw new Error(`Could not create a TypeScript program for ${config.configPath}`);
  }
  return { projectConfig: config, languageService, program };
}
