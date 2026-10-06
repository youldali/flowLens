import ts from 'typescript';

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
