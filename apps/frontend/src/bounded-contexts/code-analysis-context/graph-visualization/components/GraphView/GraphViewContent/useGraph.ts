import { useMemo } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import {
  adaptToReactFlow,
  type ReactFlowAdapterOptions,
  type ReactFlowGraph,
} from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'

interface UseGraphOptions {
  graph: FlowGraph
  direction: NonNullable<ReactFlowAdapterOptions['direction']>
  selectedNodeId: NodeId | undefined
}

interface UseGraphResult extends ReactFlowGraph {
  displayGraph: FlowGraph
}

export function useGraph({
  graph,
  direction,
  selectedNodeId,
}: UseGraphOptions): UseGraphResult {
  const displayGraph = graph
  const { nodes, edges } = useMemo(
    () => adaptToReactFlow(displayGraph, { direction, selectedNodeId }),
    [direction, displayGraph, selectedNodeId],
  )

  return { displayGraph, nodes, edges }
}
