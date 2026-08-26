import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { toProjectSourceGraph } from '@flowlens/analyzer-core/transformer'

export const GRAPH_TRANSFORMER_IDS = ['none', 'projectSource'] as const

export type GraphTransformerId = typeof GRAPH_TRANSFORMER_IDS[number]

export const DEFAULT_GRAPH_TRANSFORMER_ID = 'projectSource' satisfies GraphTransformerId

const GRAPH_TRANSFORMERS = {
  none: <TGraph extends FlowGraph>(graph: TGraph) => graph,
  projectSource: toProjectSourceGraph,
} satisfies Record<GraphTransformerId, <TGraph extends FlowGraph>(graph: TGraph) => TGraph>

export function transformGraph<TGraph extends FlowGraph>(
  graph: TGraph,
  transformer: GraphTransformerId,
): TGraph {
  return GRAPH_TRANSFORMERS[transformer](graph)
}
