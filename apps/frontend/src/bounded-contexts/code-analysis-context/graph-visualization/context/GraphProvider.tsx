import type { GraphId } from '@flowlens/analyzer-core/domain/graph-session'
import type { PropsWithChildren } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph'

import { GraphContext, type OnOpenSource } from './graphContext'
import { useGraphCleanupEffect } from './useGraphCleanupEffect'

type GraphProviderProps = PropsWithChildren<{
  graphId: GraphId
  graph: FlowGraph
  onOpenSource?: OnOpenSource
}>

export function GraphProvider({ children, graphId, graph, onOpenSource }: GraphProviderProps) {
  useGraphCleanupEffect(graphId)

  return (
    <GraphContext.Provider value={{ graphId, graph, onOpenSource }}>
      {children}
    </GraphContext.Provider>
  )
}
