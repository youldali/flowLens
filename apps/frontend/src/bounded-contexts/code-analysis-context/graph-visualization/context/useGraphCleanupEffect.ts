import type { GraphId } from '@flowlens/analyzer-core/domain/graph-session'
import { useEffect } from 'react'
import { useQueryClient } from 'react-query'
import { getExplanationGraphQueryKey } from '@code-analysis-context/code-insights/apis/useExplainNodeQuery/useExplainNodeQuery'
import { useAppDispatch } from '@store/hooks'
import { actions } from '../slice'

export function useGraphCleanupEffect(graphId: GraphId) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  useEffect(() => () => {
    void queryClient.cancelQueries(getExplanationGraphQueryKey(graphId))
  }, [graphId, queryClient])

  useEffect(() => () => {
    dispatch(actions.clearHighlightedEdge())
  }, [dispatch, graphId])
}
