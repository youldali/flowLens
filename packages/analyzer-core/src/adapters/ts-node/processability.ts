import ts from 'typescript';
import { isWithinWorkspace, normalizePath } from '@flowlens/common/fs';

import {
  isExecutableFunction,
  isTypeCallableDeclaration,
} from './functions.js';

export function isNodeProcessable(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    isExecutableFunction(node) ||
    ts.isMethodDeclaration(node) ||
    isTypeCallableDeclaration(node) ||
    ts.isCallExpression(node)
  );
}

export function isNavigable(tsconfigPath: string, source: ts.SourceFile): boolean {
  return !source.isDeclarationFile
    && !normalizePath(source.fileName).includes('/node_modules/')
    && ts.sys.fileExists(source.fileName)
    && isWithinWorkspace(tsconfigPath, source.fileName);
}
