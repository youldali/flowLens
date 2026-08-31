import { create as createEdge } from '../edge.js';
import type { Edge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import { hasOutgoingReferenceEdge, isCallExpressionNode } from '../node.js';
import type { BridgeEdgeContext } from './remove-nodes.js';
import { removeNodes } from './remove-nodes.js';

export function collapseResolvedCallExpressionNodes(graph: FlowGraph): FlowGraph {
  const resolvedCallExpressionNodeIds = new Set(
    graph.nodes
      .filter(isCallExpressionNode)
      .filter((node) => hasOutgoingReferenceEdge(graph, node))
      .map((node) => node.id),
  );

  return removeNodes(
    (node) => resolvedCallExpressionNodeIds.has(node.id),
    {
      createBridgeEdge,
    },
  )(graph);
}

function createBridgeEdge({
  incomingEdge,
  outgoingEdge,
  removedNode,
}: BridgeEdgeContext): Edge | undefined {
  if (outgoingEdge.type !== 'references' || !isCallExpressionNode(removedNode)) {
    return undefined;
  }

  return createEdge(
    incomingEdge.source,
    outgoingEdge.target,
    incomingEdge.type,
    {
      kind: 'call-expression',
      callSite: {
        filePath: removedNode.filePath,
        start: removedNode.start,
        end: removedNode.end,
        text: removedNode.text,
      },
    },
  );
}
