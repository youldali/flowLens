import type { Edge } from './edge.js';
import type { GraphNode } from './node.js';

interface Graph<TNode = GraphNode, TEdge = Edge> {
  nodes: TNode[];
  edges: TEdge[];
}

export type FlowGraph = Graph<GraphNode, Edge>;

export function isFlowGraph(value: unknown): value is FlowGraph {
  return (
    typeof value === 'object'
    && value !== null
    && 'nodes' in value
    && 'edges' in value
    && Array.isArray(value.nodes)
    && Array.isArray(value.edges)
  )
}
