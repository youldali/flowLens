import { useEffect } from 'react'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'

export function useEffectSelectionCleanup() {
  const clearSelection = graphFacade.actions.useClearSelection()

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
}
