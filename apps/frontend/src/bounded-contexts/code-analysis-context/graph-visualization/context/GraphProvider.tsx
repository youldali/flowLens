import type { PropsWithChildren } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { selectors } from '@code-analysis-context/graph-visualization/slice'
import { useAppSelector } from '@store/hooks'

import { GraphContext, type OnOpenSource } from './graphContext'

type GraphProviderProps = PropsWithChildren<{
  graph: FlowGraph
  onOpenSource?: OnOpenSource
}>

export function GraphProvider({ children, graph, onOpenSource }: GraphProviderProps) {
  const transformedGraph = useAppSelector((state) =>
    selectors.selectTransformedGraph(state, graph),
  )

  return (
    <GraphContext.Provider value={{ graph, transformedGraph, onOpenSource }}>
      {children}
    </GraphContext.Provider>
  )
}
