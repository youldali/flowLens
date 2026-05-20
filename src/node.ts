import ts from 'typescript';
import * as path from 'node:path';

import { normalizePath } from './utils.js';

export type GraphNodeKind =
  | 'functionDeclaration'
  | 'methodDeclaration'
  | 'callExpression'
  | 'file'
  | 'if-statement';

export type NodeId = string;

export interface Node {
  id: NodeId;
  kind: GraphNodeKind;
  name: string;
  filePath: string;
  tsNode: ts.Node;
}

export interface FileNode extends Node {
  kind: 'file';
}

export interface FunctionDeclarationNode extends Node {
  kind: 'functionDeclaration' | 'methodDeclaration';
  signature: ts.Signature | undefined;
  jsdoc?: string;
  tsNode: ExecutableFunctionDeclaration;
}

export interface CallExpressionNode extends Node {
  kind: 'callExpression';
  tsNode: ts.CallExpression;
  signature: ts.Signature | undefined;
  declarationTsNode: ExecutableFunctionDeclaration | undefined;
  declarationFile: string | undefined;
}

type ExecutableFunctionDeclaration = 
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

export const isFunctionDeclarationNode = (node: Node): node is FunctionDeclarationNode => {
  return node.kind === 'functionDeclaration' || node.kind === 'methodDeclaration';
}

export const isCallExpressionNode = (node: Node): node is CallExpressionNode => {
  return node.kind === 'callExpression';
}

export const isFileNode = (node: Node): node is FileNode => {
  return node.kind === 'file';
}

export function createFileId(sourceFile: ts.SourceFile): NodeId {
  return normalizePath(sourceFile.fileName);
}

export function deriveIdFromTsNode(node: ts.Node): NodeId {
  const sourceFile = node.getSourceFile();
  return `${sourceFile.fileName}:${node.pos}:${node.end}`;
}

export class NodeBuilder {
  private readonly checker: ts.TypeChecker

  constructor(checker: ts.TypeChecker) {
    this.checker = checker;
  }

  buildCallExpressionNode = (node: ts.CallExpression): CallExpressionNode => {
    const sourceFile = node.getSourceFile();
    const signature = this.checker.getResolvedSignature(node);
    const declarationFile = signature?.declaration ? normalizePath(signature.declaration.getSourceFile().fileName) : undefined;
    const declarationTsNode = this.findDeclarationForCallExpression(node);

    return {
      id: deriveIdFromTsNode(node),
      name: node.expression.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: "callExpression",
      signature,
      declarationFile,
      declarationTsNode,
      tsNode: node,
    }
  }

  buildFunctionDeclarationNode(node: ExecutableFunctionDeclaration): FunctionDeclarationNode {
    const sourceFile = node.getSourceFile();
    const symbol = this.checker.getSymbolAtLocation(node);
    const signature = symbol ? this.checker.getSignaturesOfType(this.checker.getTypeOfSymbolAtLocation(symbol, node), ts.SignatureKind.Call)[0] : undefined;
    const jsdoc = symbol ? ts.displayPartsToString(symbol.getDocumentationComment(this.checker)) : undefined;

    return {
      id: deriveIdFromTsNode(node),
      name: node.name!.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: ts.isFunctionDeclaration(node) ? 'functionDeclaration' : 'methodDeclaration',
      signature,
      ...(jsdoc ? { jsdoc } : {}),
      tsNode: node,
    }
  }

  buildFileNode (sourceFile: ts.SourceFile): FileNode {
    return {
      id: createFileId(sourceFile),
      name: path.basename(sourceFile.fileName),
      filePath: normalizePath(sourceFile.fileName),
      kind: 'file',
      tsNode: sourceFile,
    }
  }

  private findDeclarationForCallExpression(node: ts.CallExpression): ExecutableFunctionDeclaration | undefined {
    const symbol = this.checker.getSymbolAtLocation(node);
    const signature = this.checker.getResolvedSignature(node);
    const declaration = signature?.declaration;

    if (declaration && "body" in declaration && declaration.body) {
      return declaration;
    }
    else if (symbol) {
      const declarations = symbol?.getDeclarations() ?? [];
      return declarations.find(isExecutableFunction);
    }
  }
}

/**
 * Narrow to ONLY real executable function-like nodes (have bodies)
 */
function isExecutableFunction(
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

export function isNodeProcessable(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    isExecutableFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isCallExpression(node)
  );
}