import { useEffect, useRef } from 'react'
import { useMutation, type UseMutationResult } from 'react-query'
import { useVsCodeApi } from '#common/hooks/useVsCodeApi.ts'
import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import {
  requestConfigureAiProviderViaVsCode, type ConfigureAiProviderOutcome, type ConfigureAiProviderErrorReason,
} from './requestConfigureAiProvider'

type ConfigureAiProviderMutation = UseMutationResult<ConfigureAiProviderOutcome, VsCodeQueryError<ConfigureAiProviderErrorReason>, void>

export function useConfigureAiProvider(): ConfigureAiProviderMutation {
  const api = useVsCodeApi()
  const controller = useRef<AbortController | null>(null)
  const pendingRequest = useRef<Promise<ConfigureAiProviderOutcome> | null>(null)
  const mutation = useMutation<ConfigureAiProviderOutcome, VsCodeQueryError<ConfigureAiProviderErrorReason>, void>(
    () => requestConfigureAiProviderViaVsCode(api, controller.current!.signal),
    { retry: false },
  )

  useEffect(() => () => controller.current?.abort(), [])

  const mutateAsync: ConfigureAiProviderMutation['mutateAsync'] = (variables, options) => {
    if (pendingRequest.current) return pendingRequest.current
    controller.current = new AbortController()
    const request = mutation.mutateAsync(variables, options).finally(() => {
      pendingRequest.current = null
      controller.current = null
    })

    pendingRequest.current = request
    return request
  }
  const mutate: ConfigureAiProviderMutation['mutate'] = (variables, options) => {
    // React Query exposes the error in mutation state; only mutateAsync rejects to callers.
    void mutateAsync(variables, options).catch(() => {})
  }

  return { ...mutation, mutate, mutateAsync }
}
