import * as ts from 'typescript-native/ast';
import type { Checker, Program } from 'typescript-native/async';
import * as path from 'node:path';
import { normalizePath } from '@flowlens/common/fs';
import * as TsModule from './ts-node/index.js';
import type { ImplementationDiscovery } from '../infrastructure/implementation-discovery.js';
import type { NodeId, CallableTypeMemberDeclarationNode, CallExpressionNode, FunctionDeclarationNode, FileNode, SourceOrigin } from '../domain/node.js';

interface CallResolution {
  declaration: TsModule.CallableDeclaration | undefined;
  source: ts.SourceFile | undefined;
}

export class NodeAdapter {
  private readonly callableTypeMemberNodesCache = new Map<NodeId, CallableTypeMemberDeclarationNode>();
  private readonly resolutions = new WeakMap<ts.CallExpression, Promise<CallResolution>>();
  private readonly rootDir: string;

  constructor(
    private readonly checker: Checker,
    private readonly program: Program,
    private readonly implementationDiscovery: Pick<ImplementationDiscovery, 'findImplementations'>,
    rootDir: string = process.cwd(),
  ) {
    this.rootDir = normalizePath(rootDir);
  }

  async buildCallExpressionNode(node: ts.CallExpression): Promise<CallExpressionNode> {
    const sourceFile = node.getSourceFile();
    const { source } = await this.resolveCall(node);
    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: node.expression.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
      kind: 'callExpression',
      sourceOrigin: source ? await this.getSourceFileOrigin(source) : 'unknown',
      start: node.pos,
      end: node.end,
      text: node.getText(sourceFile),
      declarationFile: source ? normalizePath(source.fileName) : undefined,
    };
  }

  async findDeclarationForCallExpression(node: ts.CallExpression): Promise<TsModule.CallableDeclaration | undefined> {
    return (await this.resolveCall(node)).declaration;
  }

  async buildFunctionDeclarationNode(node: TsModule.ExecutableFunctionDeclaration): Promise<FunctionDeclarationNode> {
    const sourceFile = node.getSourceFile();
    const symbol = await this.checker.getSymbolAtLocation('name' in node && node.name ? node.name : node);
    const jsdoc = symbol ? await symbol.getDocumentationComment(this.checker) : undefined;
    return {
      id: TsModule.deriveIdFromTsNode(node),
      name: TsModule.getExecutableFunctionName(node, sourceFile),
      displayName: TsModule.getDisplayName(node),
      sourceText: node.getText(sourceFile),
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
      kind: TsModule.getExecutableFunctionKind(node),
      sourceOrigin: await this.getSourceFileOrigin(sourceFile),
      ...(jsdoc ? { jsdoc } : {}),
    };
  }

  async buildCallableTypeMemberDeclarationNode(node: TsModule.TypeCallableDeclaration): Promise<CallableTypeMemberDeclarationNode> {
    const id = TsModule.deriveIdFromTsNode(node);
    const cached = this.callableTypeMemberNodesCache.get(id);
    if (cached) return cached;
    const sourceFile = node.getSourceFile();
    const symbol = await this.checker.getSymbolAtLocation(node.name);
    const jsdoc = symbol ? await symbol.getDocumentationComment(this.checker) : undefined;
    const graphNode: CallableTypeMemberDeclarationNode = {
      id,
      name: node.name.getText(sourceFile),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
      kind: 'callableTypeMemberDeclaration',
      sourceOrigin: await this.getSourceFileOrigin(sourceFile),
      implementations: this.implementationDiscovery.findImplementations(sourceFile.fileName, node.name.getStart(sourceFile)),
      ...(jsdoc ? { jsdoc } : {}),
    };
    this.callableTypeMemberNodesCache.set(id, graphNode);
    return graphNode;
  }

  async buildFileNode(sourceFile: ts.SourceFile): Promise<FileNode> {
    return {
      id: TsModule.createFileId(sourceFile),
      name: path.basename(sourceFile.fileName),
      filePath: normalizePath(sourceFile.fileName),
      fileName: path.basename(sourceFile.fileName),
      kind: 'file',
      sourceOrigin: await this.getSourceFileOrigin(sourceFile),
    };
  }

  private resolveCall(node: ts.CallExpression): Promise<CallResolution> {
    const cached = this.resolutions.get(node);
    if (cached) return cached;
    const resolution = this.resolveCallUncached(node);
    this.resolutions.set(node, resolution);
    return resolution;
  }

  private async resolveCallUncached(node: ts.CallExpression): Promise<CallResolution> {
    const signature = await this.checker.getResolvedSignature(node);
    const signatureDeclaration = await this.checker.isUnknownSignature(signature)
      ? undefined : await signature.declaration?.resolve(this.program.getProject());
    const declarations = [
      ...await this.getSymbolDeclarations(node.expression),
      ...(ts.isPropertyAccessExpression(node.expression) ? await this.getSymbolDeclarations(node.expression.name) : []),
    ];
    const executable = signatureDeclaration && TsModule.isExecutableFunction(signatureDeclaration)
      ? signatureDeclaration : declarations.find(TsModule.isExecutableFunction);
    const candidates = [signatureDeclaration, signatureDeclaration?.parent, ...declarations]
      .filter((value): value is ts.Node => value !== undefined);
    const declaration = executable ?? candidates.find(TsModule.isTypeCallableDeclaration);
    return { declaration, source: (signatureDeclaration ?? declaration ?? declarations[0])?.getSourceFile() };
  }

  private async getSymbolDeclarations(node: ts.Node): Promise<ts.Declaration[]> {
    const { SymbolFlags } = await import('typescript-native/async');
    const located = await this.checker.getSymbolAtLocation(node);
    const symbol = located && (located.flags & SymbolFlags.Alias)
      ? await this.checker.getAliasedSymbol(located) : located;
    const declarations = await Promise.all((symbol?.declarations ?? []).map(handle => handle.resolve(this.program.getProject())));
    return declarations.filter((value): value is ts.Declaration => value !== undefined);
  }

  private async getSourceFileOrigin(sourceFile: ts.SourceFile): Promise<SourceOrigin> {
    const sourcePath = normalizePath(sourceFile.fileName);
    if (await this.program.isSourceFileDefaultLibrary(sourceFile)) return 'native-js-api';
    if (!sourcePath.includes('node_modules') && sourcePath.startsWith(this.rootDir)) return 'project';
    return sourcePath.includes('/node_modules/@types/node/') ? 'native-node-api' : 'external';
  }
}
