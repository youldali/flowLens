import { useMemo } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { transformGraph } from '@code-analysis-context/graph-visualization/domain/transformer'
import { useGraphTransformerStore } from '@code-analysis-context/graph-visualization/store'

export function useTransformer(graph: FlowGraph): FlowGraph {
  const selectedTransformer = useGraphTransformerStore((state) => state.selectedTransformer)

  return useMemo(
    () => transformGraph(graph, selectedTransformer),
    [graph, selectedTransformer],
  )
}
