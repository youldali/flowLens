import { useCallback, useEffect, useRef } from 'react'
import type { EdgeMouseHandler } from 'reactflow'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'

const HOVER_EXIT_DELAY = 150

export function useConnectionHover() {
  const highlightEdge = graphFacade.actions.useHighlightEdge()
  const clearHighlightedEdge = graphFacade.actions.useClearHighlightedEdge()
  const exitTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(exitTimeout.current), [])

  const clearHover = useCallback(() => {
    clearTimeout(exitTimeout.current)
    clearHighlightedEdge()
  }, [clearHighlightedEdge])

  const onEdgeMouseEnter = useCallback<EdgeMouseHandler>((_event, edge) => {
    clearTimeout(exitTimeout.current)
    highlightEdge(edge.id)
  }, [highlightEdge])

  const onEdgeMouseLeave = useCallback<EdgeMouseHandler>((_event, edge) => {
    clearTimeout(exitTimeout.current)
    exitTimeout.current = setTimeout(() => clearHighlightedEdge(edge.id), HOVER_EXIT_DELAY)
  }, [clearHighlightedEdge])

  return { onEdgeMouseEnter, onEdgeMouseLeave, clearHover }
}
