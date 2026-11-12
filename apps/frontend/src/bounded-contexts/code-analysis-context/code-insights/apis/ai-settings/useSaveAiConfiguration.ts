import { useRef } from 'react'
import { useMutation, useQueryClient, type UseMutationResult } from 'react-query'
import { useVsCodeApi } from '#common/hooks/useVsCodeApi.ts'
import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import type * as AiConfigDomain from '#code-analysis-context/code-insights/domain/ai-config.ts'
import { saveAiConfiguration, type AiSettingsErrorReason } from './requestAiSettings'
import { aiConfigurationQueryKey } from './useFetchAiConfiguration'

type SaveAiConfigurationVariables = {
  configuration: AiConfigDomain.AiConfigurationChange
  signal?: AbortSignal
}

type SaveAiConfigurationMutation = UseMutationResult<
  AiConfigDomain.AiConfiguration,
  VsCodeQueryError<AiSettingsErrorReason>,
  SaveAiConfigurationVariables
>

export function useSaveAiConfiguration(): SaveAiConfigurationMutation {
  const api = useVsCodeApi()
  const queryClient = useQueryClient()
  const submission = useRef<SaveAiConfigurationVariables | null>(null)
  const pendingRequest = useRef<Promise<AiConfigDomain.AiConfiguration> | null>(null)
  const mutation = useMutation<AiConfigDomain.AiConfiguration, VsCodeQueryError<AiSettingsErrorReason>, undefined>(
    () => {
      const { configuration, ...options } = submission.current!
      return saveAiConfiguration(api, configuration, options)
    },
    {
      retry: false,
      onSuccess: async savedAiConfiguration => {
        const { signal } = submission.current!
        if (signal?.aborted) return
        // A pending load must not overwrite the host-confirmed save result.
        await queryClient.cancelQueries(aiConfigurationQueryKey)
        if (!signal?.aborted) queryClient.setQueryData(aiConfigurationQueryKey, savedAiConfiguration)
      },
    },
  )

  const mutateAsync: SaveAiConfigurationMutation['mutateAsync'] = (variables, options) => {
    if (pendingRequest.current) return pendingRequest.current
    // Mutation variables are retained by React Query; keep credentials only in flight.
    submission.current = variables
    const request = mutation.mutateAsync(undefined, {
      onSuccess: (savedAiConfiguration, _, context) => options?.onSuccess?.(savedAiConfiguration, submission.current!, context),
      onError: (error, _, context) => options?.onError?.(error, submission.current!, context),
      onSettled: (savedAiConfiguration, error, _, context) => options?.onSettled?.(savedAiConfiguration, error, submission.current!, context),
    }).finally(() => {
      submission.current = null
      pendingRequest.current = null
    })
    pendingRequest.current = request
    return request
  }
  const mutate: SaveAiConfigurationMutation['mutate'] = (variables, options) => {
    // React Query exposes the error in mutation state; only mutateAsync rejects to callers.
    void mutateAsync(variables, options).catch(() => {})
  }

  return { ...mutation, mutate, mutateAsync }
}
