import * as path from 'node:path';
import type * as ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';
import { identity } from '@flowlens/common/utils';
import { normalizePath } from '@flowlens/common/fs';
import { isNavigable } from './source-navigation.js';
import type { ImplementationEntry } from '../domain/implementation.js';
import { ProjectServiceRegistry, type ProjectService } from './project-service-registry.js';

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

export class ImplementationDiscovery {
  private readonly tsconfigPath: string;
  private readonly projectServiceRegistry = ProjectServiceRegistry.getInstance();
  private readonly implementationsFound = new Map<string, ImplementationEntry[]>();

  constructor(tsconfigPath: string) {
    this.tsconfigPath = path.resolve(tsconfigPath);
  }

  findImplementations(fileName: string, position: number): ImplementationEntry[] {
    return this.findImplementationsFromCache(fileName, position)
      .match(
        identity,
        () => {
          const result = this.findImplementationsFromProjectServices(fileName, position);

          this.implementationsFound.set(this.buildCacheKey(fileName, position), result);
          return result;
        },
      );
  }

  getNavigableSource(filePath: string): ts.SourceFile | undefined {
    for (const { program } of this.projectServiceRegistry.getProjectServices(this.tsconfigPath)) {
      const source = program.getSourceFile(path.resolve(filePath));
      if (source && isNavigable(this.tsconfigPath, source)) return source;
    }
    return undefined;
  }

  private findImplementationsFromProjectServices(
    typeDeclarationFileName: string,
    position: number,
  ): ImplementationEntry[] {
    const implementationEntries = new Map<string, ImplementationEntry>();

    for (const projectService of this.projectServiceRegistry.getProjectServices(this.tsconfigPath)) {
      const { program } = projectService;

      if (!program.getSourceFile(typeDeclarationFileName)) continue;

      for (const implementationEntry of findImplementationsInProjectService(projectService, typeDeclarationFileName, position)) {
        const { filePath, offset } = implementationEntry;
        const source = program.getSourceFile(filePath);

        if (!source || !isNavigable(this.tsconfigPath, source)) continue;
        implementationEntries.set(`${filePath}:${offset}`, implementationEntry);
      }
    }

    return [...implementationEntries.values()].sort((a, b) => a.filePath.localeCompare(b.filePath) || a.offset - b.offset || a.name.localeCompare(b.name));
  }

  private buildCacheKey(fileName: string, position: number): string {
    return `${normalizePath(fileName)}:${position}`;
  }

  private findImplementationsFromCache(fileName: string, position: number): Result<ImplementationEntry[], 'not-found'> {
    const cacheKey = this.buildCacheKey(fileName, position);
    const cached = this.implementationsFound.get(cacheKey);
    return cached ? ok(cached) : err('not-found');
  }
}
