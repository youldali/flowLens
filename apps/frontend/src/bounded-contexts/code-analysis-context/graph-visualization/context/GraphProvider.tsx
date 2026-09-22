import type { PropsWithChildren } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

import { GraphContext, type OnOpenSource } from './graphContext'
import { useTransformer } from './useTransformer'

type GraphProviderProps = PropsWithChildren<{
  graph: FlowGraph
  onOpenSource?: OnOpenSource
}>

export function GraphProvider({ children, graph, onOpenSource }: GraphProviderProps) {
  const transformedGraph = useTransformer(graph)

  return (
    <GraphContext.Provider value={{ graph, transformedGraph, onOpenSource }}>
      {children}
    </GraphContext.Provider>
  )
}
