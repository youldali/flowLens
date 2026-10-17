import type { GraphId } from '@flowlens/analyzer-core/domain/graph-session'
import type { VsCodeApi } from '#common/config/index.ts'
import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract'
import {
  createVsCodeEvent, isExplainNodeResultEvent, isExplainNodeErrorEvent,
  type ExplainNodeErrorEvent,
} from '@flowlens/registries/vscode-events'

export type ExplanationTransportErrorReason = ExplainNodeErrorEvent['payload']['reason']
  | 'delivery-failed' | 'cancelled'

export class ExplanationTransportError extends Error {
  readonly reason: ExplanationTransportErrorReason

  constructor(reason: ExplanationTransportErrorReason, options?: ErrorOptions) {
    super(`Function explanation request failed: ${reason}`, options)
    this.name = 'ExplanationTransportError'
    this.reason = reason
  }
}

export function requestNodeExplanationViaVsCode(
  vscodeApi: VsCodeApi,
  graphId: GraphId,
  nodeId: NodeId,
  signal?: AbortSignal,
): Promise<FunctionExplanation> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new ExplanationTransportError('cancelled'))
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      const message = event.data

      if (!isExplainNodeResultEvent(message) && !isExplainNodeErrorEvent(message)) return
      if (message.payload.requestId !== requestId || message.payload.graphId !== graphId || message.payload.nodeId !== nodeId) return

      cleanup()
      return isExplainNodeResultEvent(message)
        ? resolve(message.payload.explanation)
        : reject(new ExplanationTransportError(message.payload.reason))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      vscodeApi.postMessage(createVsCodeEvent('explain.node', { graphId, nodeId, requestId }))
    } catch (cause) {
      cleanup()
      reject(new ExplanationTransportError('delivery-failed', { cause }))
    }
  })
}
