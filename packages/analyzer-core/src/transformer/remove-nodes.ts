import { create as createEdge } from '../edge.js';
import type { Edge } from '../edge.js';
import type { AnalyzerGraph } from '../flow-graph.js';
import type { AnalyzerNode, NodeId } from '../node.js';
import type { GraphTransformer } from './index.js';

export function removeNodes(
  predicate: (node: AnalyzerNode) => boolean,
): GraphTransformer<AnalyzerGraph> {
  return (graph) => {
    const { removedNodeIds, newGraphNodes } = computeNewNodes(graph.nodes, predicate);
    const newGraphEdges = computeNewEdges(graph.edges, removedNodeIds);

    return {
      nodes: newGraphNodes,
      edges: newGraphEdges,
    };
  };
}

function computeNewNodes(
  nodes: AnalyzerNode[],
  predicate: (node: AnalyzerNode) => boolean,
): { removedNodeIds: Set<NodeId>; newGraphNodes: AnalyzerNode[] } {
  const removedNodeIds = new Set(nodes
    .filter(predicate)
    .map((node) => node.id));
  const newGraphNodes = nodes.filter((node) => !removedNodeIds.has(node.id));

  return { removedNodeIds, newGraphNodes };
}

function computeNewEdges(edges: Edge[], removedNodeIds: Set<NodeId>): Edge[] {
  const newEdgesMap = new Map(
    edges
      .filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
      .map((edge) => [edge.id, edge]),
  );

  for (const edge of edges) {
    if (isEdgeSkippedForBridge(edge, removedNodeIds)) {
      continue;
    }

    const target = findBridgeTarget(edge.target, edges, removedNodeIds);

    if (target) {
      const bridgedEdge = createEdge(edge.source, target, edge.type);
      newEdgesMap.set(bridgedEdge.id, bridgedEdge);
    }
  }

  return Array.from(newEdgesMap.values());
}

function isEdgeSkippedForBridge(edge: Edge, removedNodeIds: Set<NodeId>): boolean {
  return removedNodeIds.has(edge.source) || !removedNodeIds.has(edge.target);
}

function findBridgeTarget(
  removedNodeId: NodeId,
  edges: Edge[],
  removedNodeIds: Set<NodeId>,
): NodeId | undefined {
  const visitedRemovedNodes = new Set<NodeId>();
  let currentNodeId: NodeId | undefined = removedNodeId;

  while (currentNodeId !== undefined) {
    if (visitedRemovedNodes.has(currentNodeId)) {
      return undefined;
    }

    visitedRemovedNodes.add(currentNodeId);

    const outgoingEdge = edges.find((edge) => edge.source === currentNodeId);

    if (outgoingEdge === undefined) {
      return undefined;
    }

    if (!removedNodeIds.has(outgoingEdge.target)) {
      return outgoingEdge.target;
    }

    currentNodeId = outgoingEdge.target;
  }

  return undefined;
}
