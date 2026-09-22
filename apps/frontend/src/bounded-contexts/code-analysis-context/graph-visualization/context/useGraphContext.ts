import { useContext } from 'react'

import { GraphContext, type GraphContextValue } from './graphContext'

export function useGraphContext(): GraphContextValue {
  const value = useContext(GraphContext)

  if (!value) {
    throw new Error('useGraphContext must be used inside GraphProvider.')
  }

  return value
}
