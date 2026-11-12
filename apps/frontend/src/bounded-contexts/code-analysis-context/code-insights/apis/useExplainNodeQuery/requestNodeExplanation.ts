import { VsCodeQueryErrorClass } from '#common/utils/QueryError/index.ts'
import type { GraphId } from '@flowlens/analyzer-core/domain/graph-session'
import { VSCODE_REQUEST_TIMEOUT_MS, type VsCodeApi } from '#common/config/index.ts'
import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract'
import {
  createVsCodeEvent, isExplainNodeResultEvent, isExplainNodeErrorEvent, type ExplainNodeErrorEvent, type ExplainNodeEvent,
} from '@flowlens/registries/vscode-events'
import type { AiBackend } from '#code-analysis-context/code-insights/domain/ai-config.ts'

export type ExplainNodeRequest = ExplainNodeEvent & {
  payload: { backend: AiBackend }
}

export type ExplanationErrorReason = ExplainNodeErrorEvent['payload']['reason'] | 'delivery-failed' | 'cancelled' | 'timed-out'

export function requestNodeExplanationViaVsCode(
  vscodeApi: VsCodeApi,
  graphId: GraphId,
  nodeId: NodeId,
  backend: AiBackend,
  signal?: AbortSignal,
): Promise<FunctionExplanation> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const timeout = setTimeout(() => {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason: 'timed-out', operation: 'explain.node', requestId }))
    }, VSCODE_REQUEST_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason: 'cancelled', operation: 'explain.node', requestId }))
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      const message = event.data

      if (!isExplainNodeResultEvent(message) && !isExplainNodeErrorEvent(message)) return
      if (message.payload.requestId !== requestId || message.payload.graphId !== graphId || message.payload.nodeId !== nodeId) return

      cleanup()
      return isExplainNodeResultEvent(message)
        ? resolve(message.payload.explanation)
        : reject(new VsCodeQueryErrorClass({ reason: message.payload.reason, statusCode: message.payload.statusCode, operation: 'explain.node', requestId }))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const event = createVsCodeEvent('explain.node', { graphId, nodeId, requestId })
      const message: ExplainNodeRequest = {
        ...event,
        payload: { ...event.payload, backend },
      }
      vscodeApi.postMessage(message)
    } catch (cause) {
      cleanup()
      reject(new VsCodeQueryErrorClass({ reason: 'delivery-failed', operation: 'explain.node', requestId, cause }))
    }
  })
}
