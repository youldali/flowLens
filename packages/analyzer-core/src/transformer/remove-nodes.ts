import { create as createEdge } from '../edge.js';
import type { Edge } from '../edge.js';
import type { Node, NodeId } from '../node.js';
import type { GraphTransformer } from './index.js';

export interface BridgeEdgeContext {
  incomingEdge: Edge;
  outgoingEdge: Edge;
  entryRemovedNode: Node;
  exitRemovedNode: Node;
}

interface BridgeExit {
  outgoingEdge: Edge;
  exitRemovedNode: Node;
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
    // Only process edges whose source is retained and whose target is removed.
    if (isEdgeSkippedForBridge(edge, removedNodeIds)) {
      continue;
    }

    const entryRemovedNode = removedNodes.get(edge.target)!;
    const bridgeExits = findBridgeExits(edge.target, edges, removedNodes);

    for (const { outgoingEdge, exitRemovedNode } of bridgeExits) {
      const bridgedEdge = options.createBridgeEdge
        ? options.createBridgeEdge({
          incomingEdge: edge,
          outgoingEdge,
          entryRemovedNode,
          exitRemovedNode,
        })
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

/**
 * Finds edges leaving a chain of removed nodes by traversing edges whose targets
 * are also removed and collecting edges whose targets are retained.
 */
function findBridgeExits(
  removedNodeId: NodeId,
  edges: Edge[],
  removedNodes: Map<NodeId, Node>,
): BridgeExit[] {
  const bridgeExits: BridgeExit[] = [];
  const visitedRemovedNodes = new Set<NodeId>();
  const nodeIdsToVisit: NodeId[] = [removedNodeId];

  for (let i = 0; i < nodeIdsToVisit.length; i += 1) {
    const currentNodeId = nodeIdsToVisit[i]!;
    if (visitedRemovedNodes.has(currentNodeId)) {
      continue;
    }

    visitedRemovedNodes.add(currentNodeId);

    const exitRemovedNode = removedNodes.get(currentNodeId)!;
    const outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);

    for (const outgoingEdge of outgoingEdges) {
      if (!removedNodes.has(outgoingEdge.target)) {
        bridgeExits.push({ outgoingEdge, exitRemovedNode });
      } else {
        nodeIdsToVisit.push(outgoingEdge.target);
      }
    }
  }

  return bridgeExits;
}
