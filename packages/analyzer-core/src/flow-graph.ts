import * as path from 'node:path';
import * as ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';
import { normalizePath } from '@flowlens/common';
import { Queue } from '@flowlens/common/queue';
import * as NodeModule from './node.js';
import * as EdgeModule from './edge.js';
import { loadProjectConfig } from './project-config.js';

export { isFlowGraph } from './flow-graph-contract.js';

export interface Graph<TNode = NodeModule.GraphNode, TEdge = EdgeModule.Edge> {
  nodes: TNode[];
  edges: TEdge[];
}

export type FlowGraph = Graph<NodeModule.GraphNode, EdgeModule.Edge>;

export type SourceFileNotFoundError = { reason: 'source-file-not-found' };
export type FromFilePositionError =
  | SourceFileNotFoundError
  | { reason: 'node-not-found' }
  | { reason: 'enclosing-function-not-found' };

type QueueItem = 
| { node: ts.CallExpression; parentNode: ts.Node } 
| { node: NodeModule.ExecutableFunctionDeclaration; parentNode: ts.Node } 
| { node: ts.SourceFile; parentNode?: undefined }
| { node: ts.Node; parentNode?: ts.Node | undefined };

export class GraphBuilder {
  private readonly program: ts.Program
  private readonly checker: ts.TypeChecker
  private readonly nodes = new Map<NodeModule.NodeId, NodeModule.Node>();
  private readonly edges: Map<EdgeModule.EdgeId, EdgeModule.Edge> = new Map()
  private readonly visitedNodes = new Set<ts.Node>();
  private readonly nodeQueue = new Queue<QueueItem>();
  private readonly rootDir: string;
  private readonly nodeBuilder: NodeModule.NodeBuilder;

  constructor(tsconfigPath: string) {
    const projectConfig = loadProjectConfig(tsconfigPath);

    this.rootDir = path.dirname(projectConfig.configPath)
    const createProgramOptions: ts.CreateProgramOptions = {
      rootNames: projectConfig.parsed.fileNames,
      options: projectConfig.parsed.options,
      ...(projectConfig.parsed.projectReferences ? { projectReferences: projectConfig.parsed.projectReferences } : {}),
    }

    if (projectConfig.parsed.projectReferences) {
      createProgramOptions.projectReferences = projectConfig.parsed.projectReferences
    }

    this.program = ts.createProgram(createProgramOptions)
    this.checker = this.program.getTypeChecker()
    this.nodeBuilder = new NodeModule.NodeBuilder(this.checker);
  }

  fromFile(entryFilePath: string): Result<void, SourceFileNotFoundError> {
    const sourceFileResult = this.getSourceFileByPath(entryFilePath);

    if (sourceFileResult.isErr()) {
      return err(sourceFileResult.error);
    }

    this.build(sourceFileResult.value);
    return ok(undefined);
  }

  fromFilePosition(
    sourceFile: ts.SourceFile | string,
    position: number,
  ): Result<void, FromFilePositionError> {
    const sourceFileResult = this.getSourceFileByPath(
      typeof sourceFile === 'string' ? sourceFile : sourceFile.fileName,
    );

    if (sourceFileResult.isErr()) {
      return err(sourceFileResult.error);
    }

    const nodeResult = NodeModule.findNodeAtPosition(sourceFileResult.value, position);

    if (nodeResult.isErr()) {
      return err({ reason: 'node-not-found' });
    }

    const enclosingFunctionResult = NodeModule.findEnclosingFunction(nodeResult.value);

    if (enclosingFunctionResult.isErr()) {
      return err({ reason: 'enclosing-function-not-found' });
    }

    this.build(enclosingFunctionResult.value, sourceFileResult.value);
    return ok(undefined);
  }

  private build(startNode: ts.Node, parentNode?: ts.Node): void {
    this.nodeQueue.enqueue({ node: startNode, parentNode });
    this.processQueue();
  }

  private processQueue(): void {
    while (this.nodeQueue.count() > 0) {
      const result = this.nodeQueue.pop();

      if (result.isErr()) {
        return;
      }

      const { node, parentNode } = result.value;
      
      if (this.visitedNodes.has(node)) {
        continue;
      }

      this.visitNode(node, parentNode);
      this.visitedNodes.add(node);
    }
  }

  private visitNode(node: ts.Node, parentNode: ts.Node | undefined): void {
    if(!this.isInternalNode(node)) {
      return;
    }
    
    if (ts.isCallExpression(node)) {
      this.visitCallExpression(node, parentNode);
    }

    if(NodeModule.isExecutableFunction(node)) {
      this.visitFunctionDeclaration(node, parentNode);
    }

    if (ts.isSourceFile(node)) {
      this.visitSourceFile(node);
    }

    // For any node, we want to keep traversing its children to find more nodes and edges, but we only want to create graph nodes and edges for specific kinds of nodes (e.g. call expressions, function declarations, source files)
    const nextParent = NodeModule.isNodeProcessable(node) ? node : parentNode;

    ts.forEachChild(node, (child) => this.nodeQueue.enqueue({ node: child, parentNode: nextParent }));
  }

  private visitSourceFile(sourceFile: ts.SourceFile): void {
    const fileNode = this.nodeBuilder.buildFileNode(sourceFile);
    this.addNode(fileNode);
  }

  private visitCallExpression(node: ts.CallExpression, parentNode: ts.Node | undefined): void {
    const callExpressionNode = this.nodeBuilder.buildCallExpressionNode(node);
    this.addNode(callExpressionNode);

    if (parentNode) {
      this.addEdge(parentNode, node, 'calls');
    }

    const declarationTsNode = callExpressionNode.declarationTsNode;
    if (declarationTsNode) {
      const declarationGraphNode = this.nodeBuilder.buildFunctionDeclarationNode(declarationTsNode);
      this.addNode(declarationGraphNode);
      this.addEdge(node, declarationTsNode, 'references');

      const fileNode = declarationTsNode.getSourceFile();
      this.nodeQueue.enqueue({ node: declarationTsNode, parentNode: fileNode });
    }
  }

  private visitFunctionDeclaration(node: NodeModule.ExecutableFunctionDeclaration, parentNode: ts.Node | undefined): void {
    const functionDeclarationGraphNode = this.nodeBuilder.buildFunctionDeclarationNode(node);
    this.addNode(functionDeclarationGraphNode);

    if (parentNode) {
      this.addEdge(parentNode, node, 'declares');
    }
  }
  
  private getSourceFileByPath(filePath: string): Result<ts.SourceFile, SourceFileNotFoundError> {
    const normalizedEntryPath = normalizePath(filePath);
    const sourceFile = this.program.getSourceFiles().find((candidate) => {
      const candidatePath = normalizePath(candidate.fileName)
      return candidatePath === normalizedEntryPath
    });

    return sourceFile ? ok(sourceFile) : err({ reason: 'source-file-not-found' });
  }

  private addNode(node: NodeModule.Node): NodeModule.Node {
    return this.nodes.getOrInsert(node.id, node);
  }

  private addEdge(source: ts.Node, target: ts.Node, type: EdgeModule.EdgeType): EdgeModule.Edge {
    const edge = EdgeModule.create(NodeModule.deriveIdFromTsNode(source), NodeModule.deriveIdFromTsNode(target), type);
    return this.edges.getOrInsert(edge.id, edge);
  }

  private isInternalNode(node: ts.Node): boolean {
    const sourceFile = node.getSourceFile();
    const path = normalizePath(sourceFile.fileName);
    return !path.includes('node_modules') && path.startsWith(this.rootDir);
  }

  extract(): FlowGraph {
    return {
      nodes: Array.from(this.nodes.values(), NodeModule.toGraphNode),
      edges: Array.from(this.edges.values()),
    }
  }
}
