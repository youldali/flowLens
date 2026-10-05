import * as path from 'node:path';
import type * as ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';
import { identity } from '@flowlens/common/utils';
import { normalizePath } from '@flowlens/common/fs';
import { isNavigable } from './tsNode/processability.js';
import type { ImplementationEntry } from './implementation.js';
import { findImplementationsFromProjectServices } from './project-service.js';
import { ProjectServiceRegistry } from './project-service-registry.js';

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
          const result = findImplementationsFromProjectServices(
            this.projectServiceRegistry.getProjectServices(this.tsconfigPath),
            fileName,
            position,
            this.tsconfigPath,
          );

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

  private buildCacheKey(fileName: string, position: number): string {
    return `${normalizePath(fileName)}:${position}`;
  }

  private findImplementationsFromCache(fileName: string, position: number): Result<ImplementationEntry[], 'not-found'> {
    const cacheKey = this.buildCacheKey(fileName, position);
    const cached = this.implementationsFound.get(cacheKey);
    return cached ? ok(cached) : err('not-found');
  }
}
