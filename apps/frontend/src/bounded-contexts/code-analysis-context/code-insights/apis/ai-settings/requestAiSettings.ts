import { VSCODE_REQUEST_TIMEOUT_MS, type VsCodeApi } from '#common/config/index.ts'
import { VsCodeQueryErrorClass } from '#common/utils/QueryError/index.ts'
import {
  createVsCodeEvent, isAiSettingsResultEvent, isAiSettingsErrorEvent, type VsCodeEventRegistry,
} from '@flowlens/registries/vscode-events'
import type * as AiConfigDomain from '#code-analysis-context/code-insights/domain/ai-config.ts'

export type AiSettingsErrorReason = VsCodeEventRegistry['ai.settings.error']['payload']['reason']
  | 'timed-out' | 'delivery-failed' | 'cancelled'

export type SaveAiConfigurationOptions = {
  signal?: AbortSignal
  onSuccess?: (configuration: AiConfigDomain.AiConfiguration) => void | Promise<void>
  onFailure?: (error: unknown) => void | Promise<void>
}

export function fetchAiConfiguration(api: VsCodeApi, signal?: AbortSignal): Promise<AiConfigDomain.AiConfiguration> {
  return requestAiSettings(api, createVsCodeEvent('ai.settings.get', { requestId: crypto.randomUUID() }), signal)
}

export async function saveAiConfiguration(
  api: VsCodeApi,
  configuration: AiConfigDomain.AiConfigurationChange,
  options: SaveAiConfigurationOptions = {},
): Promise<AiConfigDomain.AiConfiguration> {
  let saved: AiConfigDomain.AiConfiguration

  try {
    saved = await requestAiSettings(api, createVsCodeEvent('ai.settings.save', { requestId: crypto.randomUUID(), configuration }), options.signal)
  } catch (error) {
    await options.onFailure?.(error)
    throw error
  }

  await options.onSuccess?.(saved)
  return saved
}

function requestAiSettings(
  api: VsCodeApi,
  request: VsCodeEventRegistry['ai.settings.get' | 'ai.settings.save'],
  signal?: AbortSignal,
): Promise<AiConfigDomain.AiConfiguration> {
  return new Promise((resolve, reject) => {
    const { requestId } = request.payload
    const timeout = setTimeout(() => fail('timed-out'), VSCODE_REQUEST_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
    }
    const fail = (reason: AiSettingsErrorReason) => {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason, operation: request.type, requestId }))
    }
    const onAbort = () => fail('cancelled')
    const onMessage = (event: MessageEvent<unknown>) => {
      if (isAiSettingsErrorEvent(event.data) && event.data.payload.requestId === requestId) {
        fail(event.data.payload.reason)
        return
      }
      if (!isAiSettingsResultEvent(event.data) || event.data.payload.requestId !== requestId) return

      cleanup()
      const { backend, credentialPresence } = event.data.payload.configuration
      resolve({ backend, credentialPresence: { openai: credentialPresence.openai, anthropic: credentialPresence.anthropic } })
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      api.postMessage(request)
    } catch {
      // A transport exception may contain the submitted key; never retain it in query/error state.
      fail('delivery-failed')
    }
  })
}
