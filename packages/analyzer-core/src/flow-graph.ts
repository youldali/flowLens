import * as path from 'node:path';
import * as ts from 'typescript';
import { normalizePath } from '@flowlens/common';
import type { Graph } from '@flowlens/graph-model';
import * as NodeModule from './node.js';
import * as EdgeModule from './edge.js';
import { loadProjectConfig } from './project-config.js';
import { Queue } from './queue.js';

export type AnalyzerGraph = Graph<NodeModule.Node, EdgeModule.Edge>;

type QueueItem = 
| { node: ts.CallExpression; parentNode: ts.Node } 
| { node: ts.FunctionDeclaration | ts.MethodDeclaration; parentNode: ts.Node } 
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

  build(entryFilePath: string): void {
    const sourceFile = this.getSourceFileByPath(entryFilePath);
    this.nodeQueue.enqueue({ node: sourceFile });
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

    if(ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
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

      console.group(`Enqueuing declaration for call expression: ${callExpressionNode.name}`);
      console.log(`parentNode: ${parentNode.getText()}`, NodeModule.deriveIdFromTsNode(parentNode), parentNode.kind);
      console.log(`node: ${node.getText()}`, NodeModule.deriveIdFromTsNode(node), node.kind);
      console.log(`calls`);
      console.groupEnd();
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

  private visitFunctionDeclaration(node: ts.FunctionDeclaration | ts.MethodDeclaration, parentNode: ts.Node | undefined): void {
    const functionDeclarationGraphNode = this.nodeBuilder.buildFunctionDeclarationNode(node);
    this.addNode(functionDeclarationGraphNode);

    if (parentNode) {
      this.addEdge(parentNode, node, 'declares');
    }
  }
  
  private getSourceFileByPath(filePath: string): ts.SourceFile {
    const normalizedEntryPath = normalizePath(filePath);
    const sourceFile = this.program.getSourceFiles().find((candidate) => {
      const candidatePath = normalizePath(candidate.fileName)
      return candidatePath === normalizedEntryPath
    });

    if (!sourceFile) {
      throw new Error(
        `Entry file is not part of the TypeScript program: ${filePath}`,
      )
    }

    return sourceFile;
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

  extract(): AnalyzerGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
    }
  }
  
}
