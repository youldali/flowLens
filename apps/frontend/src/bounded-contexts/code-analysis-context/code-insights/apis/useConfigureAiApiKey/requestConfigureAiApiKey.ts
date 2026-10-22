import type { VsCodeApi } from '#common/config/index.ts'
import { VsCodeQueryErrorClass } from '#common/utils/QueryError/index.ts'
import { createVsCodeEvent, isConfigureAiResultEvent, type ConfigureAiOutcome } from '@flowlens/registries/vscode-events'

export type ConfigureAiApiKeyOutcome = Exclude<ConfigureAiOutcome, 'failed'>
export type ConfigureAiApiKeyErrorReason = 'configuration-failed' | 'delivery-failed' | 'cancelled'

export function requestConfigureAiApiKeyViaVsCode(
  api: VsCodeApi,
  signal?: AbortSignal,
): Promise<ConfigureAiApiKeyOutcome> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const cleanup = () => {
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
      return outcome === 'failed'
        ? reject(new VsCodeQueryErrorClass({ reason: 'configuration-failed', operation: 'ai.configure', requestId }))
        : resolve(outcome)
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
