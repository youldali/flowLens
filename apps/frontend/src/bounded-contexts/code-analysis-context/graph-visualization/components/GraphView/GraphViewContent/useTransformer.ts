import { useMemo } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { transformGraph } from '@code-analysis-context/graph-visualization/domain/transformer'
import { selectors } from '@code-analysis-context/graph-visualization/store'
import { useAppSelector } from '@store/hooks'

export function useTransformer(graph: FlowGraph): FlowGraph {
  const selectedTransformer = useAppSelector(selectors.selectSelectedTransformer)

  return useMemo(
    () => transformGraph(graph, selectedTransformer),
    [graph, selectedTransformer],
  )
}
