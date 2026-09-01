import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import {
  toFlowGraph,
  toProjectSourceGraph,
} from '@flowlens/analyzer-core/transformer'

export const GRAPH_TRANSFORMER_IDS = ['none', 'flow', 'projectSource'] as const

export type GraphTransformerId = typeof GRAPH_TRANSFORMER_IDS[number]

export const DEFAULT_GRAPH_TRANSFORMER_ID = 'projectSource' satisfies GraphTransformerId

const GRAPH_TRANSFORMERS = {
  none: (graph: FlowGraph) => graph,
  flow: toFlowGraph,
  projectSource: toProjectSourceGraph,
} satisfies Record<GraphTransformerId, (graph: FlowGraph) => FlowGraph>

export function transformGraph(
  graph: FlowGraph,
  transformer: GraphTransformerId,
): FlowGraph {
  return GRAPH_TRANSFORMERS[transformer](graph)
}
