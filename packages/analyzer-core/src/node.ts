import ts from 'typescript';
import * as path from 'node:path';

import { normalizePath } from '@flowlens/common';
import type { FlowGraph } from './flow-graph.js';
import * as TsModule from './tsNode.js';

export type GraphNodeKind =
  | 'functionDeclaration'
  | 'methodDeclaration'
  | 'callExpression'
  | 'file'
  | 'if-statement';

export type NodeId = string;
export type SourceOrigin =
  | 'project'
  | 'external'
  | 'native-js-api'
  | 'native-node-api'
  | 'unknown';

export interface SerializedGraphNode {
  id: NodeId;
  kind: GraphNodeKind;
  name: string;
  filePath: string;
  sourceOrigin: SourceOrigin;
  start?: number | undefined;
  end?: number | undefined;
  text?: string | undefined;
}

export interface AnalyzerNode extends SerializedGraphNode {
  tsNode: ts.Node;
}

export interface FileNode extends AnalyzerNode {
  kind: 'file';
}

export interface FunctionDeclarationNode extends AnalyzerNode {
  kind: 'functionDeclaration' | 'methodDeclaration';
  signature: ts.Signature | undefined;
  jsdoc?: string;
  tsNode: TsModule.ExecutableFunctionDeclaration;
}

export interface CallExpressionNode extends AnalyzerNode {
  kind: 'callExpression';
  start: number;
  end: number;
  text: string;
  tsNode: ts.CallExpression;
  signature: ts.Signature | undefined;
  declarationTsNode: TsModule.ExecutableFunctionDeclaration | undefined;
  declarationFile: string | undefined;
}

export interface CallExpressionNodeWithDeclaration extends CallExpressionNode {
  declarationTsNode: TsModule.ExecutableFunctionDeclaration;
}

export const isFunctionDeclarationNode = (node: AnalyzerNode): node is FunctionDeclarationNode => {
  return node.kind === 'functionDeclaration' || node.kind === 'methodDeclaration';
}

export const isCallExpressionNode = (node: AnalyzerNode): node is CallExpressionNode => {
  return node.kind === 'callExpression';
}

export const isCallExpressionNodeWithCallSite = (
  node: SerializedGraphNode,
): node is SerializedGraphNode & { kind: 'callExpression'; start: number; end: number; text: string } => {
  return (
    node.kind === 'callExpression' &&
    typeof node.start === 'number' &&
    typeof node.end === 'number' &&
    typeof node.text === 'string'
  );
}

export const hasOutgoingReferenceEdge = (graph: FlowGraph, node: SerializedGraphNode): boolean => {
  return graph.edges.some((edge) => edge.source === node.id && edge.type === 'references');
}

export const hasCallExpressionDeclaration = (node: CallExpressionNode): node is CallExpressionNodeWithDeclaration => {
  return node.declarationTsNode !== undefined;
}

export const isFileNode = (node: AnalyzerNode): node is FileNode => {
  return node.kind === 'file';
}

export class NodeBuilder {
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
    const declarationTsNode = this.findDeclarationForCallExpression(node);
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
      signature,
      declarationFile,
      declarationTsNode,
      tsNode: node,
    }
  }

  buildFunctionDeclarationNode(node: TsModule.ExecutableFunctionDeclaration): FunctionDeclarationNode {
    const sourceFile = node.getSourceFile();
    const symbol = this.checker.getSymbolAtLocation(node);
    const signature = symbol ? this.checker.getSignaturesOfType(this.checker.getTypeOfSymbolAtLocation(symbol, node), ts.SignatureKind.Call)[0] : undefined;
    const jsdoc = symbol ? ts.displayPartsToString(symbol.getDocumentationComment(this.checker)) : undefined;

    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: TsModule.getExecutableFunctionName(node, sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: TsModule.getExecutableFunctionKind(node),
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
      signature,
      ...(jsdoc ? { jsdoc } : {}),
      tsNode: node,
    }
  }

  buildFileNode (sourceFile: ts.SourceFile): FileNode {
    return {
      id: TsModule.createFileId(sourceFile),
      name: path.basename(sourceFile.fileName),
      filePath: normalizePath(sourceFile.fileName),
      kind: 'file',
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
      tsNode: sourceFile,
    }
  }

  private findDeclarationSourceFile(
    node: ts.CallExpression,
    signature: ts.Signature | undefined,
    declarationTsNode: TsModule.ExecutableFunctionDeclaration | undefined,
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

  private findDeclarationForCallExpression(node: ts.CallExpression): TsModule.ExecutableFunctionDeclaration | undefined {
    const signature = this.checker.getResolvedSignature(node);
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

  private isNativeJsApiSourceFile(sourceFile: ts.SourceFile): boolean {
    return this.program?.isSourceFileDefaultLibrary(sourceFile) ?? false;
  }

  private isNativeNodeApiSourceFile(sourcePath: string): boolean {
    return sourcePath.includes('/node_modules/@types/node/');
  }
}

export function toSerializedGraphNode(node: AnalyzerNode): SerializedGraphNode {
  const serializedNode: SerializedGraphNode = {
    id: node.id,
    kind: node.kind,
    name: node.name,
    filePath: node.filePath,
    sourceOrigin: node.sourceOrigin,
  };

  return isCallExpressionNode(node)
    ? {
      ...serializedNode,
      start: node.start,
      end: node.end,
      text: node.text,
    }
    : serializedNode;
}
