import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import type { GraphId } from '@flowlens/analyzer-core/domain/graph-session'
import { useQuery, type UseQueryResult } from 'react-query'
import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import { graphFacade } from '#code-analysis-context/graph-visualization/adapters/graphFacade.ts'
import { useVsCodeApi } from '#common/hooks/useVsCodeApi.ts'
import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract'
import { requestNodeExplanationViaVsCode, type ExplanationErrorReason } from './requestNodeExplanation'

export function useExplainNodeQuery(nodeId: NodeId): UseQueryResult<FunctionExplanation, VsCodeQueryError<ExplanationErrorReason>> {
  const graphId = graphFacade.data.useGraphId()
  const vscodeApi = useVsCodeApi()

  return useQuery<FunctionExplanation, VsCodeQueryError<ExplanationErrorReason>>(
    getExplanationQueryKey(graphId, nodeId),
    ({ signal }) => requestNodeExplanationViaVsCode(vscodeApi, graphId, nodeId, signal),
    { enabled: false, retry: false },
  )
}

export const getExplanationQueryKey = (graphId: GraphId, nodeId: NodeId) =>
  [...getExplanationGraphQueryKey(graphId), nodeId] as const

export const getExplanationGraphQueryKey = (graphId: GraphId) =>
  ['graph', graphId, 'explanation'] as const
