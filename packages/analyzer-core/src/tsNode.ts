import ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';

import { normalizePath } from '@flowlens/common';
import type { NodeId } from './node.js';

export type ExecutableFunctionDeclaration =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

export function findNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
): Result<ts.Node, "not-found"> {
  let nodeAtPosition: ts.Node | undefined;

  function visit(node: ts.Node): void {
    if (
      position < node.getStart(sourceFile) ||
      position >= node.getEnd()
    ) {
      return;
    }

    nodeAtPosition = node;
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return !nodeAtPosition ? err("not-found") : ok(nodeAtPosition);
}

export function findEnclosingFunction(
  node: ts.Node,
): Result<ExecutableFunctionDeclaration, "not-found"> {
  let current: ts.Node | undefined = node;

  while (current) {
    if (isExecutableFunction(current)) {
      return ok(current);
    }

    current = current.parent;
  }

  return err("not-found");
}

export function createFileId(sourceFile: ts.SourceFile): NodeId {
  return normalizePath(sourceFile.fileName);
}

export function deriveIdFromTsNode(node: ts.Node): NodeId {
  const sourceFile = node.getSourceFile();
  return `${sourceFile.fileName}:${node.pos}:${node.end}`;
}

/**
 * Narrow to ONLY real executable function-like nodes (have bodies)
 */
export function isExecutableFunction(
  node: ts.Node
): node is ExecutableFunctionDeclaration {
  return ts.isFunctionLike(node) && (node as any).body && (node as any).body != null;

  // return (
  //   ts.isFunctionDeclaration(node) ||
  //   ts.isMethodDeclaration(node) ||
  //   ts.isConstructorDeclaration(node) ||
  //   ts.isFunctionExpression(node) ||
  //   ts.isArrowFunction(node) ||
  //   ts.isGetAccessorDeclaration(node) ||
  //   ts.isSetAccessorDeclaration(node)
  // );
}

export function getExecutableFunctionName(
  node: ExecutableFunctionDeclaration,
  sourceFile: ts.SourceFile,
): string {
  if ("name" in node && node.name) {
    return node.name.getText(sourceFile);
  }

  const parent = node.parent;

  if (parent && ts.isVariableDeclaration(parent)) {
    return parent.name.getText(sourceFile);
  }

  if (parent && ts.isPropertyAssignment(parent)) {
    return parent.name.getText(sourceFile);
  }

  return ts.isConstructorDeclaration(node) ? "constructor" : "anonymous";
}

export function getExecutableFunctionKind(
  node: ExecutableFunctionDeclaration,
): "functionDeclaration" | "methodDeclaration" {
  return ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isAccessor(node)
    ? "methodDeclaration"
    : "functionDeclaration";
}

export function isNodeProcessable(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    isExecutableFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isCallExpression(node)
  );
}
