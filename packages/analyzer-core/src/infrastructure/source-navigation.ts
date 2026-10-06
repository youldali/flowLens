import ts from 'typescript';
import { isWithinWorkspace, normalizePath } from '@flowlens/common/fs';

export function isNavigable(tsconfigPath: string, source: ts.SourceFile): boolean {
  return !source.isDeclarationFile
    && !normalizePath(source.fileName).includes('/node_modules/')
    && ts.sys.fileExists(source.fileName)
    && isWithinWorkspace(tsconfigPath, source.fileName);
}
