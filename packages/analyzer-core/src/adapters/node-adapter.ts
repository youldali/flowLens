import type { ImplementationDiscovery } from '../infrastructure/implementation-discovery.js';
import ts from 'typescript';
import * as path from 'node:path';

import { normalizePath } from '@flowlens/common/fs';
import * as TsModule from './ts-node/index.js';

import type { NodeId, CallableTypeMemberDeclarationNode, CallExpressionNode, FunctionDeclarationNode, FileNode, SourceOrigin } from '../domain/node.js';

export class NodeAdapter {
  private readonly checker: ts.TypeChecker
  private readonly program: ts.Program
  private readonly implementationDiscovery: Pick<ImplementationDiscovery, 'findImplementations'>
  private readonly rootDir: string
  private readonly callableTypeMemberNodesCache = new Map<NodeId, CallableTypeMemberDeclarationNode>()

  constructor(
    checker: ts.TypeChecker,
    program: ts.Program,
    implementationDiscovery: Pick<ImplementationDiscovery, 'findImplementations'>,
    rootDir: string = process.cwd(),
  ) {
    this.checker = checker;
    this.program = program;
    this.implementationDiscovery = implementationDiscovery;
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
      fileName: path.basename(sourceFile.fileName),
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
      displayName: TsModule.getDisplayName(node),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
      kind: TsModule.getExecutableFunctionKind(node),
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
      ...(jsdoc ? { jsdoc } : {}),
    }
  }

  buildCallableTypeMemberDeclarationNode(
    node: TsModule.TypeCallableDeclaration,
  ): CallableTypeMemberDeclarationNode {
    const id = TsModule.deriveIdFromTsNode(node);
    const nodeFromCache = this.callableTypeMemberNodesCache.get(id);
    if (nodeFromCache) {
      return nodeFromCache;
    }

    const sourceFile = node.getSourceFile();
    const symbol = this.checker.getSymbolAtLocation(node.name);
    const jsdoc = symbol ? ts.displayPartsToString(symbol.getDocumentationComment(this.checker)) : undefined;

    const graphNode: CallableTypeMemberDeclarationNode = {
      id,
      name: node.name.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
      kind: 'callableTypeMemberDeclaration',
      sourceOrigin: this.getSourceFileOrigin(sourceFile),
      implementations: this.implementationDiscovery.findImplementations(sourceFile.fileName, node.name.getStart(sourceFile)),
      ...(jsdoc ? { jsdoc } : {}),
    };
    this.callableTypeMemberNodesCache.set(id, graphNode);
    return graphNode;
  }

  buildFileNode (sourceFile: ts.SourceFile): FileNode {
    return {
      id: TsModule.createFileId(sourceFile),
      name: path.basename(sourceFile.fileName),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
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
