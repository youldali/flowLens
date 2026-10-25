import { existsSync } from 'node:fs';
import type { SourceFile } from 'typescript-native/ast';
import { isWithinWorkspace, normalizePath } from '@flowlens/common/fs';

export function isNavigable(tsconfigPath: string, source: SourceFile): boolean {
  return !source.isDeclarationFile
    && !normalizePath(source.fileName).includes('/node_modules/')
    && existsSync(source.fileName)
    && isWithinWorkspace(tsconfigPath, source.fileName);
}
