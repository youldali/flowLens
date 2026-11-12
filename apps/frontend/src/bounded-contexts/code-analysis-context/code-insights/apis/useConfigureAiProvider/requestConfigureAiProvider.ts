import { VSCODE_REQUEST_TIMEOUT_MS, type VsCodeApi } from '#common/config/index.ts'
import { VsCodeQueryErrorClass } from '#common/utils/QueryError/index.ts'
import { createVsCodeEvent, isConfigureAiResultEvent, type ConfigureAiOutcome } from '@flowlens/registries/vscode-events'

export type ConfigureAiProviderOutcome = Extract<ConfigureAiOutcome, 'saved'>
export type ConfigureAiProviderErrorReason = 'configuration-failed' | 'delivery-failed' | 'cancelled' | 'timed-out'

export function requestConfigureAiProviderViaVsCode(
  api: VsCodeApi,
  signal?: AbortSignal,
): Promise<ConfigureAiProviderOutcome> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const timeout = setTimeout(() => {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason: 'timed-out', operation: 'ai.configure', requestId }))
    }, VSCODE_REQUEST_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason: 'cancelled', operation: 'ai.configure', requestId }))
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isConfigureAiResultEvent(event.data) || event.data.payload.requestId !== requestId) return
      const { outcome } = event.data.payload

      cleanup()
      return outcome === 'saved'
        ? resolve(outcome)
        : reject(new VsCodeQueryErrorClass({
          reason: outcome === 'cancelled' ? 'cancelled' : 'configuration-failed',
          operation: 'ai.configure',
          requestId,
        }))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      api.postMessage(createVsCodeEvent('ai.configure', { requestId }))
    } catch (cause) {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason: 'delivery-failed', operation: 'ai.configure', requestId, cause }))
    }
  })
}
