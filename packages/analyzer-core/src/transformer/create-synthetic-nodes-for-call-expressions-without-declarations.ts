import { create as createEdge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import {
  hasOutgoingReferenceEdge,
  isCallExpressionNode,
  type CallExpressionNode,
  type UnresolvedCallDeclarationNode,
} from '../node.js';

export function createSyntheticNodesForCallExpressionsWithoutDeclarations(
  graph: FlowGraph,
): FlowGraph {
  const callExpressionNodesWithoutDeclarations = graph.nodes
    .filter(isCallExpressionNode)
    .filter((node) => !hasOutgoingReferenceEdge(graph, node));

  if (callExpressionNodesWithoutDeclarations.length === 0) {
    return graph;
  }

  const unresolvedCallDeclarationNodes = callExpressionNodesWithoutDeclarations
    .map(createUnresolvedCallDeclarationNode);
  const unresolvedCallDeclarationReferenceEdges = callExpressionNodesWithoutDeclarations
    .map((node) => createEdge(
      node.id,
      createUnresolvedCallDeclarationNodeId(node),
      'references',
    ));

  return {
    nodes: [...graph.nodes, ...unresolvedCallDeclarationNodes],
    edges: [...graph.edges, ...unresolvedCallDeclarationReferenceEdges],
  };
}

function createUnresolvedCallDeclarationNode(
  node: CallExpressionNode,
): UnresolvedCallDeclarationNode {
  return {
    kind: 'unresolved-call-declaration',
    id: createUnresolvedCallDeclarationNodeId(node),
    name: node.name.trim() || node.text.trim(),
    filePath: node.filePath,
    sourceOrigin: node.sourceOrigin,
    start: node.start,
    end: node.end,
  };
}

function createUnresolvedCallDeclarationNodeId(node: CallExpressionNode): string {
  return `unresolved-call-declaration:${node.id}`;
}
