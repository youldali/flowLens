import * as path from 'node:path';
import * as ts from 'typescript';
import { loadProjectConfig, type ConfigPath, type ProjectConfig } from './project-config.js';
import { findWorkspaceRoot } from '@flowlens/common/fs';
import { discoverWorkspaceProjects } from './workspace-projects.js';

export interface ProjectService {
  projectConfig: ProjectConfig;
  languageService: ts.LanguageService;
  program: ts.Program;
}

export class ProjectServiceRegistry {
  private static readonly instance = new ProjectServiceRegistry();
  private readonly projectServices = new Map<ConfigPath, ProjectService>();
  private readonly discoveredWorkspaces = new Set<string>();

  private constructor() {}

  static getInstance(): ProjectServiceRegistry {
    return this.instance;
  }

  getService(tsconfigPath: string): ProjectService {
    const configPath = path.resolve(tsconfigPath);
    return this.projectServices.getOrInsertComputed(configPath, () => createProjectService(loadProjectConfig(configPath)));
  }

  *getProjectServices(tsconfigPath: string): Generator<ProjectService> {
    const workspaceRoot = findWorkspaceRoot(path.resolve(tsconfigPath));
    this.discoverProjectServices(workspaceRoot);
    yield* [...this.projectServices.values()]
      .filter(service => findWorkspaceRoot(service.projectConfig.configPath) === workspaceRoot)
      .sort((a, b) => a.projectConfig.configPath.localeCompare(b.projectConfig.configPath));
  }

  clear(): void {
    this.projectServices.forEach(service => service.languageService.dispose());
    this.projectServices.clear();
    this.discoveredWorkspaces.clear();
  }

  private discoverProjectServices(workspaceRoot: string): void {
    if (this.discoveredWorkspaces.has(workspaceRoot)) return;
    discoverWorkspaceProjects(workspaceRoot).forEach(config => this.resolveService(config));
    this.discoveredWorkspaces.add(workspaceRoot);
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
