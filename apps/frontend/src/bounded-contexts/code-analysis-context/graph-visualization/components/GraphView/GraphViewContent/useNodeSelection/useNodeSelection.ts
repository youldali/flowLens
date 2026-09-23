import { useCallback, useEffect } from 'react'
import type { NodeId } from '@flowlens/analyzer-core/node'
import {
  actions,
  selectors,
} from '@code-analysis-context/graph-visualization/store'
import { useAppDispatch, useAppSelector } from '@store/hooks'

export function useNodeSelection() {
  const selectedNodeId = useAppSelector(selectors.selectSelectedNodeId)
  const dispatch = useAppDispatch()
  const selectNode = useCallback((nodeId: NodeId) => {
    dispatch(actions.selectNode(nodeId))
  }, [dispatch])
  const clearSelection = useCallback(() => {
    dispatch(actions.clearNodeSelection())
  }, [dispatch])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      clearSelection()
    }
  }, [clearSelection])

  return { selectedNodeId, selectNode, clearSelection }
}
