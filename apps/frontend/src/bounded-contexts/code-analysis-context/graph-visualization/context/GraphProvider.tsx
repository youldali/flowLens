import { useEffect, type PropsWithChildren } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph'

import { useAppDispatch } from '@store/hooks'
import { actions } from '../slice'
import { GraphContext, type OnOpenSource } from './graphContext'

type GraphProviderProps = PropsWithChildren<{
  graph: FlowGraph
  onOpenSource?: OnOpenSource
}>

export function GraphProvider({ children, graph, onOpenSource }: GraphProviderProps) {
  const dispatch = useAppDispatch()

  useEffect(() => () => {
    dispatch(actions.clearHighlightedEdge())
  }, [dispatch, graph])

  return (
    <GraphContext.Provider value={{ graph, onOpenSource }}>
      {children}
    </GraphContext.Provider>
  )
}
