import ts from 'typescript';
import * as path from 'node:path';

import { normalizePath } from '@flowlens/common';
import * as TsModule from './tsNode.js';

export type GraphNodeKind =
  | 'functionDeclaration'
  | 'methodDeclaration'
  | 'callExpression'
  | 'file'
  | 'if-statement';

export type NodeId = string;
export type SourceOrigin = 'project' | 'external' | 'unknown';

export interface SerializedGraphNode {
  id: NodeId;
  kind: GraphNodeKind;
  name: string;
  filePath: string;
  sourceOrigin: SourceOrigin;
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

export const hasCallExpressionDeclaration = (node: CallExpressionNode): node is CallExpressionNodeWithDeclaration => {
  return node.declarationTsNode !== undefined;
}

export const isFileNode = (node: AnalyzerNode): node is FileNode => {
  return node.kind === 'file';
}

export class NodeBuilder {
  private readonly checker: ts.TypeChecker
  private readonly rootDir: string

  constructor(checker: ts.TypeChecker, rootDir: string = process.cwd()) {
    this.checker = checker;
    this.rootDir = normalizePath(rootDir);
  }

  buildCallExpressionNode = (node: ts.CallExpression): CallExpressionNode => {
    const sourceFile = node.getSourceFile();
    const signature = this.checker.getResolvedSignature(node);
    const declarationFile = signature?.declaration ? normalizePath(signature.declaration.getSourceFile().fileName) : undefined;
    const declarationTsNode = this.findDeclarationForCallExpression(node);

    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: node.expression.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      kind: "callExpression",
      sourceOrigin: this.getCallExpressionSourceOrigin(signature, declarationTsNode),
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

  private getCallExpressionSourceOrigin(
    signature: ts.Signature | undefined,
    declarationTsNode: TsModule.ExecutableFunctionDeclaration | undefined,
  ): SourceOrigin {
    if (declarationTsNode) {
      return this.getSourceFileOrigin(declarationTsNode.getSourceFile());
    }

    return signature?.declaration
      ? this.getSourceFileOrigin(signature.declaration.getSourceFile())
      : 'unknown';
  }

  private getSourceFileOrigin(sourceFile: ts.SourceFile): SourceOrigin {
    const sourcePath = normalizePath(sourceFile.fileName);
    return !sourcePath.includes('node_modules') && sourcePath.startsWith(this.rootDir)
      ? 'project'
      : 'external';
  }

  private findDeclarationForCallExpression(node: ts.CallExpression): TsModule.ExecutableFunctionDeclaration | undefined {
    const symbol = this.checker.getSymbolAtLocation(node);
    const signature = this.checker.getResolvedSignature(node);
    const declaration = signature?.declaration;

    if (declaration && "body" in declaration && declaration.body) {
      return declaration;
    }
    else if (symbol) {
      const declarations = symbol?.getDeclarations() ?? [];
      return declarations.find(TsModule.isExecutableFunction);
    }
  }
}

export function toSerializedGraphNode(node: AnalyzerNode): SerializedGraphNode {
  return {
    id: node.id,
    kind: node.kind,
    name: node.name,
    filePath: node.filePath,
    sourceOrigin: node.sourceOrigin,
  };
}
