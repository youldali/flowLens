import * as path from 'node:path';
import * as ts from 'typescript';
import { normalizePath } from '@flowlens/common/fs';
import type { ImplementationEntry } from '../domain/implementation.js';
import type { ProjectConfig } from './project-config.js';
import { isNavigable } from '../adapters/ts-node/processability.js';

export interface ProjectService {
  projectConfig: ProjectConfig;
  languageService: ts.LanguageService;
  program: ts.Program;
}

export function createProjectService(config: ProjectConfig): ProjectService {
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

export function findImplementationsInProjectService(
  projectService: ProjectService,
  typeDeclarationFileName: string,
  position: number,
): ImplementationEntry[] {
  const { languageService, program } = projectService;
  const implementationEntries: ImplementationEntry[] = [];

  for (const location of languageService.getImplementationAtPosition(typeDeclarationFileName, position) ?? []) {
    const source = program.getSourceFile(location.fileName);
    if (!source) continue;
    const filePath = normalizePath(source.fileName);
    const { start, length } = location.textSpan;
    const coordinates = source.getLineAndCharacterOfPosition(start);

    implementationEntries.push({
      name: source.text.slice(start, start + length) || path.basename(filePath),
      filePath,
      line: coordinates.line + 1,
      column: coordinates.character + 1,
      offset: start,
    });
  }

  return implementationEntries;
}

export function findImplementationsFromProjectServices(
  projectServices: Iterable<ProjectService>,
  typeDeclarationFileName: string,
  position: number,
  tsconfigPath: string,
): ImplementationEntry[] {
  const implementationEntries = new Map<string, ImplementationEntry>();

  for (const projectService of projectServices) {
    const { program } = projectService;

    if (!program.getSourceFile(typeDeclarationFileName)) continue;

    for (const implementationEntry of findImplementationsInProjectService(projectService, typeDeclarationFileName, position)) {
      const { filePath, offset } = implementationEntry;
      const source = program.getSourceFile(filePath);

      if (!source || !isNavigable(tsconfigPath, source)) continue;
      implementationEntries.set(`${filePath}:${offset}`, implementationEntry);
    }
  }

  return [...implementationEntries.values()].sort((a, b) => a.filePath.localeCompare(b.filePath) || a.offset - b.offset || a.name.localeCompare(b.name));
}
