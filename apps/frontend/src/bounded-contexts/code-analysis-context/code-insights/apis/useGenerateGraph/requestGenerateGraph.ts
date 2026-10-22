import type { VsCodeApi } from '#common/config/index.ts'
import { VsCodeQueryErrorClass } from '#common/utils/QueryError/index.ts'
import { createVsCodeEvent } from '@flowlens/registries/vscode-events'

export async function requestGenerateGraphViaVsCode(api: VsCodeApi): Promise<void> {
  try {
    api.postMessage(createVsCodeEvent('graph.generate', {}))
  } catch (cause) {
    throw new VsCodeQueryErrorClass({ reason: 'delivery-failed', operation: 'graph.generate', cause })
  }
}
