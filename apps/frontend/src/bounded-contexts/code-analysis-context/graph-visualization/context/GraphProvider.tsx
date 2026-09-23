import type { PropsWithChildren } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

import { GraphContext, type OnOpenSource } from './graphContext'

type GraphProviderProps = PropsWithChildren<{
  graph: FlowGraph
  onOpenSource?: OnOpenSource
}>

export function GraphProvider({ children, graph, onOpenSource }: GraphProviderProps) {
  return (
    <GraphContext.Provider value={{ graph, onOpenSource }}>
      {children}
    </GraphContext.Provider>
  )
}
