import { create as createEdge } from '../edge.js';
import type { CallExpressionEdgeMetadata, Edge } from '../edge.js';
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
  exitRemovedNode,
}: BridgeEdgeContext): Edge {
  if (!isCallExpressionNode(exitRemovedNode)) {
    throw new Error(`Expected removed node ${exitRemovedNode.id} to be a call expression`);
  }

  const metadata: CallExpressionEdgeMetadata = {
    kind: 'call-expression',
    callSite: {
      filePath: exitRemovedNode.filePath,
      start: exitRemovedNode.start,
      end: exitRemovedNode.end,
      text: exitRemovedNode.text,
    },
  };

  switch (outgoingEdge.type) {
    case 'references':
      return createEdge(incomingEdge.source, outgoingEdge.target, incomingEdge.type, metadata);
    case 'declares':
      return createEdge(incomingEdge.source, outgoingEdge.target, 'declares', metadata);
    case 'calls':
      return createEdge(incomingEdge.source, outgoingEdge.target, 'calls', metadata);
    case 'imports':
      return createEdge(incomingEdge.source, outgoingEdge.target, 'imports', metadata);
  }
}
