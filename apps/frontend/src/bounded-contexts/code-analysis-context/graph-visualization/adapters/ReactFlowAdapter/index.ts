import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

import { layoutDagre, type DagreLayoutOptions } from './layoutDagre.ts'
import { toReactFlow, type ReactFlowGraph } from './toReactFlow.ts'

export type ReactFlowAdapterOptions = DagreLayoutOptions

export function adaptToReactFlow(
  graph: FlowGraph,
  options: ReactFlowAdapterOptions = {},
): ReactFlowGraph {
  const flowGraph = toReactFlow(graph)

  return {
    nodes: layoutDagre(flowGraph.nodes, flowGraph.edges, options),
    edges: flowGraph.edges,
  }
}
