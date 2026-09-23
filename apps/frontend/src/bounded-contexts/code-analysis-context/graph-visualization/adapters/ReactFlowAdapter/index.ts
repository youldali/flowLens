import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'

import { layoutDagre, type DagreLayoutOptions } from './layoutDagre.ts'
import { toReactFlow, type ReactFlowGraph } from './toReactFlow.ts'

export interface ReactFlowAdapterOptions extends DagreLayoutOptions {
  selectedNodeId?: NodeId | undefined
}
export type { LayoutDirection } from './layoutDagre.ts'
export type { ReactFlowGraph } from './toReactFlow.ts'

export function adaptToReactFlow(
  graph: FlowGraph,
  options: ReactFlowAdapterOptions = {},
): ReactFlowGraph {
  const flowGraph = toReactFlow(graph)
  const { selectedNodeId, ...layoutOptions } = options

  return {
    nodes: layoutDagre(flowGraph.nodes, flowGraph.edges, layoutOptions).map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    })),
    edges: flowGraph.edges,
  }
}
