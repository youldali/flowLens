import { useQuery } from 'react-query'
import { useVsCodeApi } from '#common/hooks/useVsCodeApi.ts'
import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import type { AiConfiguration } from '#code-analysis-context/code-insights/domain/ai-config.ts'
import { fetchAiConfiguration, type AiSettingsErrorReason } from './requestAiSettings'

export const aiConfigurationQueryKey = ['ai', 'settings'] as const

export function useFetchAiConfiguration({ enabled = true } = {}) {
  const api = useVsCodeApi()

  return useQuery<AiConfiguration, VsCodeQueryError<AiSettingsErrorReason>>(
    aiConfigurationQueryKey,
    ({ signal }) => fetchAiConfiguration(api, signal),
    {
      enabled,
      retry: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  )
}
