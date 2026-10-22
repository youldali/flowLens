import { useEffect, useRef } from 'react'
import { useMutation, type UseMutationResult } from 'react-query'
import { useVsCodeApi } from '#common/hooks/useVsCodeApi.ts'
import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import {
  requestConfigureAiApiKeyViaVsCode, type ConfigureAiApiKeyOutcome, type ConfigureAiApiKeyErrorReason,
} from './requestConfigureAiApiKey'

type ConfigureAiApiKeyMutation = UseMutationResult<ConfigureAiApiKeyOutcome, VsCodeQueryError<ConfigureAiApiKeyErrorReason>, void>

export function useConfigureAiApiKey(): ConfigureAiApiKeyMutation {
  const api = useVsCodeApi()
  const controller = useRef<AbortController | null>(null)
  const pendingRequest = useRef<Promise<ConfigureAiApiKeyOutcome> | null>(null)
  const mutation = useMutation<ConfigureAiApiKeyOutcome, VsCodeQueryError<ConfigureAiApiKeyErrorReason>, void>(
    () => requestConfigureAiApiKeyViaVsCode(api, controller.current!.signal),
    { retry: false },
  )

  useEffect(() => () => controller.current?.abort(), [])

  const mutateAsync: ConfigureAiApiKeyMutation['mutateAsync'] = (variables, options) => {
    if (pendingRequest.current) return pendingRequest.current
    controller.current = new AbortController()
    const request = mutation.mutateAsync(variables, options).finally(() => {
      pendingRequest.current = null
      controller.current = null
    })

    pendingRequest.current = request
    return request
  }
  const mutate: ConfigureAiApiKeyMutation['mutate'] = (variables, options) => {
    // React Query exposes the error in mutation state; only mutateAsync rejects to callers.
    void mutateAsync(variables, options).catch(() => {})
  }

  return { ...mutation, mutate, mutateAsync }
}
