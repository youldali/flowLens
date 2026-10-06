import type { FlowGraph } from './flow-graph.js';
import type { ImplementationEntry } from './implementation.js';

export type { ImplementationEntry } from './implementation.js';

export type GraphNodeKind =
  | 'functionDeclaration'
  | 'methodDeclaration'
  | 'callableTypeMemberDeclaration'
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
  displayName?: string | undefined;
  filePath: string;
  fileName: string;
  sourceOrigin: SourceOrigin;
}

export interface FileNode extends Node {
  kind: 'file';
}

export interface FunctionDeclarationNode extends Node {
  kind: 'functionDeclaration' | 'methodDeclaration';
  displayName: string;
  jsdoc?: string | undefined;
}

export interface CallableTypeMemberDeclarationNode extends Node {
  kind: 'callableTypeMemberDeclaration';
  jsdoc?: string | undefined;
  implementations: ImplementationEntry[];
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

export const isCallableTypeMemberDeclarationNode = (
  node: Node,
): node is CallableTypeMemberDeclarationNode => {
  return node.kind === 'callableTypeMemberDeclaration';
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
