import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Project } from 'typescript-native/async';
import type { SourceFile } from 'typescript-native/ast';
import { err, ok, type Result } from 'neverthrow';
import { normalizePath, type FilePath } from '@flowlens/common/fs';
import { identity } from '@flowlens/common/utils';
import { isNavigable } from './source-navigation.js';
import { buildImplementation, type ImplementationEntry } from '#domain/implementation';
import type { TypeScriptCompilationRegistry } from './typescript-compilation-registry.js';

type DeclarationLocation = string;

export class ImplementationDiscovery {
  private readonly tsconfigPath: FilePath;
  private readonly implementationsFound = new Map<DeclarationLocation, ImplementationEntry[]>();

  constructor(tsconfigPath: FilePath, private readonly compilationRegistry: TypeScriptCompilationRegistry) {
    this.tsconfigPath = path.resolve(tsconfigPath);
  }

  async findImplementations(fileName: FilePath, position: number): Promise<ImplementationEntry[]> {
    const filePath = path.resolve(fileName);
    const cacheKey = `${normalizePath(filePath)}:${position}`;

    return this.findImplementationsInCache(cacheKey).match(
      identity,
      () => this.searchImplementations(filePath, position, cacheKey),
    );
  }

  private findImplementationsInCache(cacheKey: DeclarationLocation): Result<ImplementationEntry[], 'cache-miss'> {
    const cached = this.implementationsFound.get(cacheKey);

    return cached === undefined ? err('cache-miss') : ok(cached);
  }

  private async searchImplementations(filePath: FilePath, position: number, cacheKey: DeclarationLocation): Promise<ImplementationEntry[]> {
    // Loading every workspace project makes sibling implementations visible to LSP.
    const projects = await this.compilationRegistry.getProjects();
    const source = await findSource(projects, filePath);
    if (!source) return [];
    const coordinates = source.getLineAndCharacterOfPosition(position);
    const server = await this.compilationRegistry.getServer();
    const locations = await server.findImplementations(filePath, coordinates.line, coordinates.character);
    const entries = new Map<string, ImplementationEntry>();

    for (const location of locations) {
      const implementationSource = await findSource(projects, fileURLToPath(location.uri));
      if (!implementationSource || !isNavigable(this.tsconfigPath, implementationSource)) continue;
      const implementation = buildImplementation(implementationSource, location);

      entries.set(`${implementation.filePath}:${implementation.offset}`, implementation);
    }

    const result = [...entries.values()].sort((a, b) => a.filePath.localeCompare(b.filePath) || a.offset - b.offset || a.name.localeCompare(b.name));
    this.implementationsFound.set(cacheKey, result);
    return result;
  }
}

async function findSource(projects: readonly Project[], filePath: FilePath): Promise<SourceFile | undefined> {
  for (const { program } of projects) {
    const source = await program.getSourceFile(filePath);
    if (source) return source;
  }

  return undefined;
}
