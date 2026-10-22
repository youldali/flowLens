import { useMutation, type UseMutationResult } from 'react-query'
import { useVsCodeApi } from '#common/hooks/useVsCodeApi.ts'
import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import { requestGenerateGraphViaVsCode } from './requestGenerateGraph'

export function useGenerateGraph(): UseMutationResult<void, VsCodeQueryError<'delivery-failed'>, void> {
  const api = useVsCodeApi()

  return useMutation(() => requestGenerateGraphViaVsCode(api), { retry: false })
}
