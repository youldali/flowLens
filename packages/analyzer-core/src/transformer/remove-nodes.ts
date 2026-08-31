import { create as createEdge } from '../edge.js';
import type { Edge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import type { Node, NodeId } from '../node.js';
import type { GraphTransformer } from './index.js';

export interface BridgeEdgeContext {
  incomingEdge: Edge;
  outgoingEdge: Edge;
  removedNode: Node;
}

export interface RemoveNodesOptions {
  createBridgeEdge?: (context: BridgeEdgeContext) => Edge | undefined;
}

export function removeNodes(
  predicate: (node: Node) => boolean,
  options: RemoveNodesOptions = {},
): GraphTransformer {
  return (graph) => {
    const { removedNodes, newGraphNodes } = computeNewNodes(graph.nodes, predicate);
    const newGraphEdges = computeNewEdges(graph.edges, removedNodes, options);

    return {
      nodes: newGraphNodes,
      edges: newGraphEdges,
    };
  };
}

function computeNewNodes(
  nodes: Node[],
  predicate: (node: Node) => boolean,
): { removedNodes: Map<NodeId, Node>; newGraphNodes: Node[] } {
  const removedNodes = new Map(nodes
    .filter(predicate)
    .map((node) => [node.id, node]));
  const newGraphNodes = nodes.filter((node) => !removedNodes.has(node.id));

  return { removedNodes, newGraphNodes };
}

function computeNewEdges(
  edges: Edge[],
  removedNodes: Map<NodeId, Node>,
  options: RemoveNodesOptions,
): Edge[] {
  const removedNodeIds = new Set(removedNodes.keys());
  const newEdgesMap = new Map(
    edges
      .filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
      .map((edge) => [edge.id, edge]),
  );

  for (const edge of edges) {
    if (isEdgeSkippedForBridge(edge, removedNodeIds)) {
      continue;
    }

    const removedNode = removedNodes.get(edge.target);
    if (!removedNode) {
      continue;
    }

    const outgoingEdges = findBridgeOutgoingEdges(edge.target, edges, removedNodeIds);

    for (const outgoingEdge of outgoingEdges) {
      const bridgedEdge = options.createBridgeEdge
        ? options.createBridgeEdge({ incomingEdge: edge, outgoingEdge, removedNode })
        : createEdge(edge.source, outgoingEdge.target, edge.type);
      if (!bridgedEdge) {
        continue;
      }

      newEdgesMap.set(bridgedEdge.id, bridgedEdge);
    }
  }

  return Array.from(newEdgesMap.values());
}

function isEdgeSkippedForBridge(edge: Edge, removedNodeIds: Set<NodeId>): boolean {
  return removedNodeIds.has(edge.source) || !removedNodeIds.has(edge.target);
}

function findBridgeOutgoingEdges(
  removedNodeId: NodeId,
  edges: Edge[],
  removedNodeIds: Set<NodeId>,
): Edge[] {
  const bridgeOutgoingEdges = new Map<NodeId, Edge>();
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
        bridgeOutgoingEdges.set(outgoingEdge.target, outgoingEdge);
        continue;
      }

      nodeIdsToVisit.push(outgoingEdge.target);
    }
  }

  return Array.from(bridgeOutgoingEdges.values());
}
