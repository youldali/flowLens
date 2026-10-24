import * as path from 'node:path';
import * as ts from 'typescript-native/ast';
import type { Program } from 'typescript-native/async';
import { err, ok, type Result } from 'neverthrow';
import { normalizePath } from '@flowlens/common/fs';
import { Queue } from '@flowlens/common/queue';
import * as NodeModule from '../domain/node.js';
import * as TsNodeModule from './ts-node/index.js';
import * as EdgeModule from '../domain/edge.js';
import type { ProjectService } from '../infrastructure/project-service-registry.js';
import type { RepositoryAnalysisContext } from '../infrastructure/repository-analysis-context.js';
import { ImplementationDiscovery } from '../infrastructure/implementation-discovery.js';

import type { FlowGraph } from '../domain/flow-graph.js';
import { NodeAdapter } from './node-adapter.js';

export type SourceFileNotFoundError = { reason: 'source-file-not-found' };
export type FromFilePositionError =
  | SourceFileNotFoundError
  | { reason: 'node-not-found' }
  | { reason: 'enclosing-function-not-found' };

type QueueItem = 
| { node: ts.CallExpression; parentNode: ts.Node } 
| { node: TsNodeModule.CallableDeclaration; parentNode: ts.Node }
| { node: ts.SourceFile; parentNode?: undefined }
| { node: ts.Node; parentNode?: ts.Node | undefined };

export class GraphAdapter {
  private readonly program: Program
  private readonly nodes = new Map<NodeModule.NodeId, NodeModule.Node>();
  private readonly tsNodesByNodeId = new Map<NodeModule.NodeId, ts.Node>();
  private readonly edges: Map<EdgeModule.EdgeId, EdgeModule.Edge> = new Map()
  private readonly visitedNodes = new Set<ts.Node>();
  private readonly nodeQueue = new Queue<QueueItem>();
  private readonly rootDir: string;
  private readonly implementationDiscovery: ImplementationDiscovery;
  private readonly nodeAdapter: NodeAdapter;

  static async create(tsconfigPath: string, context: RepositoryAnalysisContext): Promise<GraphAdapter> {
    const projectService = await context.nativeRegistry.getService(tsconfigPath);
    return new GraphAdapter(tsconfigPath, projectService, context);
  }

  private constructor(tsconfigPath: string, projectService: ProjectService, context: RepositoryAnalysisContext) {
    this.rootDir = path.dirname(projectService.projectConfig.configPath)
    this.program = projectService.program;
    this.implementationDiscovery = new ImplementationDiscovery(tsconfigPath, context.legacyRegistry);
    this.nodeAdapter = new NodeAdapter(projectService.project.checker, this.program, this.implementationDiscovery, this.rootDir);
  }

  async fromFile(entryFilePath: string): Promise<Result<void, SourceFileNotFoundError>> {
    const sourceFileResult = await this.getSourceFileByPath(entryFilePath);

    if (sourceFileResult.isErr()) {
      return err(sourceFileResult.error);
    }

    await this.build(sourceFileResult.value);
    return ok(undefined);
  }

  async fromFilePosition(
    sourceFile: { fileName: string } | string,
    position: number,
  ): Promise<Result<void, FromFilePositionError>> {
    const sourceFileResult = await this.getSourceFileByPath(
      typeof sourceFile === 'string' ? sourceFile : sourceFile.fileName,
    );

    if (sourceFileResult.isErr()) {
      return err(sourceFileResult.error);
    }

    const nodeResult = TsNodeModule.findNodeAtPosition(sourceFileResult.value, position);

    if (nodeResult.isErr()) {
      return err({ reason: 'node-not-found' });
    }

    const enclosingFunctionResult = TsNodeModule.findEnclosingFunction(nodeResult.value);

    if (enclosingFunctionResult.isErr()) {
      return err({ reason: 'enclosing-function-not-found' });
    }

    await this.build(enclosingFunctionResult.value, sourceFileResult.value);
    return ok(undefined);
  }

  private async build(startNode: ts.Node, parentNode?: ts.Node): Promise<void> {
    this.nodeQueue.enqueue({ node: startNode, parentNode });
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.nodeQueue.count() > 0) {
      const result = this.nodeQueue.pop();

      if (result.isErr()) {
        return;
      }

      const { node, parentNode } = result.value;
      
      if (this.visitedNodes.has(node)) {
        continue;
      }

      await this.visitNode(node, parentNode);
      this.visitedNodes.add(node);
    }
  }

  private async visitNode(node: ts.Node, parentNode: ts.Node | undefined): Promise<void> {
    if(!this.isInternalNode(node)) {
      return;
    }
    
    if (ts.isCallExpression(node)) {
      await this.visitCallExpression(node, parentNode);
    }

    if(TsNodeModule.isExecutableFunction(node)) {
      await this.visitFunctionDeclaration(node, parentNode);
    }

    if (TsNodeModule.isTypeCallableDeclaration(node)) {
      await this.visitCallableTypeMemberDeclaration(node, parentNode);
    }

    if (ts.isSourceFile(node)) {
      await this.visitSourceFile(node);
    }

    // For any node, we want to keep traversing its children to find more nodes and edges, but we only want to create graph nodes and edges for specific kinds of nodes (e.g. call expressions, function declarations, source files)
    const nextParent = TsNodeModule.isNodeProcessable(node) ? node : parentNode;

    node.forEachChild((child) => { this.nodeQueue.enqueue({ node: child, parentNode: nextParent }); });
  }

  private async visitSourceFile(sourceFile: ts.SourceFile): Promise<void> {
    const fileNode = await this.nodeAdapter.buildFileNode(sourceFile);
    this.addNode(fileNode, sourceFile);
  }

  private async visitCallExpression(node: ts.CallExpression, parentNode: ts.Node | undefined): Promise<void> {
    const callExpressionNode = await this.nodeAdapter.buildCallExpressionNode(node);
    const declarationTsNode = await this.nodeAdapter.findDeclarationForCallExpression(node);
    this.addNode(callExpressionNode, node);

    if (parentNode) {
      this.addEdge(parentNode, node, 'calls');
    }

    if (declarationTsNode) {
      const declarationGraphNode = TsNodeModule.isTypeCallableDeclaration(declarationTsNode)
        ? await this.nodeAdapter.buildCallableTypeMemberDeclarationNode(declarationTsNode)
        : await this.nodeAdapter.buildFunctionDeclarationNode(declarationTsNode);
      this.addNode(declarationGraphNode, declarationTsNode);
      this.addEdge(node, declarationTsNode, 'references');

      const fileNode = declarationTsNode.getSourceFile();
      this.nodeQueue.enqueue({ node: declarationTsNode, parentNode: fileNode });
    }
  }

  private async visitFunctionDeclaration(node: TsNodeModule.ExecutableFunctionDeclaration, parentNode: ts.Node | undefined): Promise<void> {
    const functionDeclarationGraphNode = await this.nodeAdapter.buildFunctionDeclarationNode(node);
    this.addNode(functionDeclarationGraphNode, node);

    if (parentNode) {
      this.addEdge(parentNode, node, 'declares');
    }
  }

  private async visitCallableTypeMemberDeclaration(
    node: TsNodeModule.TypeCallableDeclaration,
    parentNode: ts.Node | undefined,
  ): Promise<void> {
    const declarationGraphNode = await this.nodeAdapter.buildCallableTypeMemberDeclarationNode(node);
    this.addNode(declarationGraphNode, node);

    if (parentNode) {
      this.addEdge(parentNode, node, 'declares');
    }
  }
  
  private async getSourceFileByPath(filePath: string): Promise<Result<ts.SourceFile, SourceFileNotFoundError>> {
    const sourceFile = await this.program.getSourceFile(path.resolve(filePath));

    return sourceFile ? ok(sourceFile) : err({ reason: 'source-file-not-found' });
  }

  private addNode(
    node: NodeModule.Node,
    tsNode: ts.Node,
  ): NodeModule.Node {
    this.tsNodesByNodeId.set(node.id, tsNode);
    return this.nodes.getOrInsert(node.id, node);
  }

  private addEdge(source: ts.Node, target: ts.Node, type: EdgeModule.EdgeType): EdgeModule.Edge {
    const edge = EdgeModule.create(TsNodeModule.deriveIdFromTsNode(source), TsNodeModule.deriveIdFromTsNode(target), type);
    return this.edges.getOrInsert(edge.id, edge);
  }

  private isInternalNode(node: ts.Node): boolean {
    const sourceFile = node.getSourceFile();
    const path = normalizePath(sourceFile.fileName);
    return !path.includes('node_modules') && path.startsWith(this.rootDir);
  }

  extract(): FlowGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    }
  }

  getNavigableSource(filePath: string): Result<string, SourceFileNotFoundError> {
    const sourceFile = this.implementationDiscovery.getNavigableSource(filePath);
    return sourceFile ? ok(sourceFile.text) : err({ reason: 'source-file-not-found' });
  }
}
