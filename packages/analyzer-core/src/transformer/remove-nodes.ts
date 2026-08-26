import { create as createEdge } from '../edge.js';
import type { Edge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import type { NodeId, SerializedGraphNode } from '../node.js';
import type { GraphTransformer } from './index.js';

export function removeNodes<TGraph extends FlowGraph>(
  predicate: (node: TGraph['nodes'][number]) => boolean,
): GraphTransformer<TGraph> {
  return (graph) => {
    const { removedNodeIds, newGraphNodes } = computeNewNodes(graph.nodes, predicate);
    const newGraphEdges = computeNewEdges(graph.edges, removedNodeIds);

    return {
      nodes: newGraphNodes,
      edges: newGraphEdges,
    } as TGraph;
  };
}

function computeNewNodes<TNode extends SerializedGraphNode>(
  nodes: TNode[],
  predicate: (node: TNode) => boolean,
): { removedNodeIds: Set<NodeId>; newGraphNodes: TNode[] } {
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

    const targets = findBridgeTargets(edge.target, edges, removedNodeIds);

    for (const target of targets) {
      const bridgedEdge = createEdge(edge.source, target, edge.type);
      newEdgesMap.set(bridgedEdge.id, bridgedEdge);
    }
  }

  return Array.from(newEdgesMap.values());
}

function isEdgeSkippedForBridge(edge: Edge, removedNodeIds: Set<NodeId>): boolean {
  return removedNodeIds.has(edge.source) || !removedNodeIds.has(edge.target);
}

function findBridgeTargets(
  removedNodeId: NodeId,
  edges: Edge[],
  removedNodeIds: Set<NodeId>,
): NodeId[] {
  const bridgeTargets = new Set<NodeId>();
  const visitedRemovedNodes = new Set<NodeId>();
  const nodeIdsToVisit: NodeId[] = [removedNodeId];

  for (let visitIndex = 0; visitIndex < nodeIdsToVisit.length; visitIndex += 1) {
    const currentNodeId = nodeIdsToVisit[visitIndex]!;
    if (visitedRemovedNodes.has(currentNodeId)) {
      continue;
    }

    visitedRemovedNodes.add(currentNodeId);

    const outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);

    for (const outgoingEdge of outgoingEdges) {
      if (!removedNodeIds.has(outgoingEdge.target)) {
        bridgeTargets.add(outgoingEdge.target);
        continue;
      }

      nodeIdsToVisit.push(outgoingEdge.target);
    }
  }

  return Array.from(bridgeTargets);
}
