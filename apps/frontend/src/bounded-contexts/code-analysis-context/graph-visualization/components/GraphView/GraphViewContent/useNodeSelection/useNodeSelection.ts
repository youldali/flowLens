import { useEffect, useReducer } from 'react'
import {
  getNodeSelectionKeyboardAction,
  reduceNodeSelection,
} from './nodeSelectionReducer'

export function useNodeSelection() {
  const [selectedNodeId, dispatchSelection] = useReducer(
    reduceNodeSelection,
    undefined,
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      const action = getNodeSelectionKeyboardAction(event.key)

      if (action) {
        dispatchSelection(action)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [dispatchSelection])

  return [selectedNodeId, dispatchSelection] as const
}
