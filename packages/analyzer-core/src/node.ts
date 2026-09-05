import ts from 'typescript';
import * as path from 'node:path';

import { normalizePath } from '@flowlens/common';
import type { FlowGraph } from './flow-graph.js';
import * as TsModule from './tsNode.js';

export type GraphNodeKind =
  | 'functionDeclaration'
  | 'methodDeclaration'
  | 'typeDeclaration'
  | 'callExpression'
  | 'unresolved-call-declaration'
  | 'file'
  | 'if-statement';

export type NodeId = string;
export type SourceOrigin =
  | 'project'
  | 'external'
  | 'native-js-api'
  | 'native-node-api'
  | 'unknown';

export interface Node {
  id: NodeId;
  kind: GraphNodeKind;
  name: string;
  filePath: string;
  sourceOrigin: SourceOrigin;
}

export interface FileNode extends Node {
  kind: 'file';
}

export interface FunctionDeclarationNode extends Node {
  kind: 'functionDeclaration' | 'methodDeclaration';
  jsdoc?: string | undefined;
}

export interface TypeDeclarationNode extends Node {
  kind: 'typeDeclaration';
  jsdoc?: string | undefined;
}

export interface CallExpressionNode extends Node {
  kind: 'callExpression';
  start: number;
  end: number;
  text: string;
  declarationFile: string | undefined;
}

export interface UnresolvedCallDeclarationNode extends Node {
  kind: 'unresolved-call-declaration';
  start: number;
  end: number;
}

export const isFunctionDeclarationNode = (node: Node): node is FunctionDeclarationNode => {
  return node.kind === 'functionDeclaration' || node.kind === 'methodDeclaration';
}

export const isTypeDeclarationNode = (node: Node): node is TypeDeclarationNode => {
  return node.kind === 'typeDeclaration';
}

export const isCallExpressionNode = (node: Node): node is CallExpressionNode => {
  return node.kind === 'callExpression';
}

export const isUnresolvedCallDeclarationNode = (
  node: Node,
): node is UnresolvedCallDeclarationNode => {
  return node.kind === 'unresolved-call-declaration';
}

export const hasOutgoingReferenceEdge = (graph: FlowGraph, node: Node): boolean => {
  return graph.edges.some((edge) => edge.source === node.id && edge.type === 'references');
}

export const isFileNode = (node: Node): node is FileNode => {
  return node.kind === 'file';
}

export class NodeAdapter {
  private readonly checker: ts.TypeChecker
  private readonly program: ts.Program | undefined
  private readonly rootDir: string

  constructor(checker: ts.TypeChecker, rootDir: string = process.cwd(), program?: ts.Program) {
    this.checker = checker;
    this.program = program;
    this.rootDir = normalizePath(rootDir);
  }

  buildCallExpressionNode = (node: ts.CallExpression): CallExpressionNode => {
    const sourceFile = node.getSourceFile();
    const signature = this.checker.getResolvedSignature(node);
    const declarationTsNode = this.findExecutableDeclarationForCallExpression(node, signature);
    const declarationSourceFile = this.findDeclarationSourceFile(node, signature, declarationTsNode);
    const declarationFile = declarationSourceFile ? normalizePath(declarationSourceFile.fileName) : undefined;

    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: node.expression.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: "callExpression",
      sourceOrigin: declarationSourceFile ? this.getSourceFileOrigin(declarationSourceFile) : 'unknown',
      start: node.pos,
      end: node.end,
      text: node.getText(sourceFile),
      declarationFile,
    }
  }

  findDeclarationForCallExpression(
    node: ts.CallExpression,
  ): TsModule.CallableDeclaration | undefined {
    const signature = this.checker.getResolvedSignature(node);
    return this.findExecutableDeclarationForCallExpression(node, signature)
      ?? this.findTypeDeclarationForCallExpression(node, signature);
  }

  buildFunctionDeclarationNode(node: TsModule.ExecutableFunctionDeclaration): FunctionDeclarationNode {
    const sourceFile = node.getSourceFile();
    const symbol = this.checker.getSymbolAtLocation(node);
    const jsdoc = symbol ? ts.displayPartsToString(symbol.getDocumentationComment(this.checker)) : undefined;

    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: TsModule.getExecutableFunctionName(node, sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: TsModule.getExecutableFunctionKind(node),
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
      ...(jsdoc ? { jsdoc } : {}),
    }
  }

  buildTypeDeclarationNode(
    node: TsModule.TypeCallableDeclaration,
  ): TypeDeclarationNode {
    const sourceFile = node.getSourceFile();
    const symbol = this.checker.getSymbolAtLocation(node.name);
    const jsdoc = symbol ? ts.displayPartsToString(symbol.getDocumentationComment(this.checker)) : undefined;

    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: node.name.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: 'typeDeclaration',
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
      ...(jsdoc ? { jsdoc } : {}),
    };
  }

  buildFileNode (sourceFile: ts.SourceFile): FileNode {
    return {
      id: TsModule.createFileId(sourceFile),
      name: path.basename(sourceFile.fileName),
      filePath: normalizePath(sourceFile.fileName),
      kind: 'file',
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
    }
  }

  private findDeclarationSourceFile(
    node: ts.CallExpression,
    signature: ts.Signature | undefined,
    declarationTsNode: TsModule.CallableDeclaration | undefined,
  ): ts.SourceFile | undefined {
    const declarations = [
      signature?.declaration,
      declarationTsNode,
      ...this.getSymbolDeclarations(node.expression),
      ...this.getPropertyAccessNameDeclarations(node),
    ].filter((declaration): declaration is ts.Declaration => declaration !== undefined);

    return declarations[0]?.getSourceFile();
  }

  private getSymbolDeclarations(node: ts.Node): ts.Declaration[] {
    return this.checker.getSymbolAtLocation(node)?.getDeclarations() ?? [];
  }

  private getPropertyAccessNameDeclarations(node: ts.CallExpression): ts.Declaration[] {
    return ts.isPropertyAccessExpression(node.expression)
      ? this.getSymbolDeclarations(node.expression.name)
      : [];
  }

  private getSourceFileOrigin(sourceFile: ts.SourceFile): SourceOrigin {
    const sourcePath = normalizePath(sourceFile.fileName);

    if (this.isNativeJsApiSourceFile(sourceFile)) {
      return 'native-js-api';
    }

    if (!sourcePath.includes('node_modules') && sourcePath.startsWith(this.rootDir)) {
      return 'project';
    }

    return this.isNativeNodeApiSourceFile(sourcePath) ? 'native-node-api' : 'external';
  }

  private findExecutableDeclarationForCallExpression(
    node: ts.CallExpression,
    signature: ts.Signature | undefined,
  ): TsModule.ExecutableFunctionDeclaration | undefined {
    const declaration = signature?.declaration;

    if (declaration && "body" in declaration && declaration.body) {
      return declaration;
    }

    const declarations = [
      ...this.getSymbolDeclarations(node.expression),
      ...this.getPropertyAccessNameDeclarations(node),
    ];

    return declarations.find(TsModule.isExecutableFunction);
  }

  private findTypeDeclarationForCallExpression(
    node: ts.CallExpression,
    signature: ts.Signature | undefined,
  ): TsModule.TypeCallableDeclaration | undefined {
    const signatureDeclaration = signature?.declaration;
    const declarations = [
      signatureDeclaration,
      signatureDeclaration?.parent,
      ...this.getSymbolDeclarations(node.expression),
      ...this.getPropertyAccessNameDeclarations(node),
    ].filter((declaration): declaration is ts.Node => declaration !== undefined);

    return declarations.find(TsModule.isTypeCallableDeclaration);
  }

  private isNativeJsApiSourceFile(sourceFile: ts.SourceFile): boolean {
    return this.program?.isSourceFileDefaultLibrary(sourceFile) ?? false;
  }

  private isNativeNodeApiSourceFile(sourcePath: string): boolean {
    return sourcePath.includes('/node_modules/@types/node/');
  }
}
