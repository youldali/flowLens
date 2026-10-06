import type * as NodeModule from './node.js';
import type * as EdgeModule from './edge.js';

export { isFlowGraph } from './flow-graph-contract.js';

export interface FlowGraph {
  nodes: NodeModule.Node[];
  edges: EdgeModule.Edge[];
}

export function isEmpty(graph: FlowGraph): boolean {
  return graph.nodes.length === 0;
}

export function findNodeInGraphById(
  graph: FlowGraph,
  nodeId: NodeModule.NodeId,
): NodeModule.Node | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}
