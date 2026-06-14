import { useEffect, useState } from 'react'
import { useVsCodeApi } from '@common/hooks/useVsCodeApi'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph-contract'
import { createVsCodeEvent, parseVsCodeEvent } from '@flowlens/registries/vscode-events'

export function useGraph(): FlowGraph | undefined {
  const [graph, setGraph] = useState<FlowGraph>()
  const vscodeApi = useVsCodeApi()

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const nextGraph = getGraphFromMessage(event.data)

      if (nextGraph) {
        setGraph(nextGraph)
      }
    }

    window.addEventListener('message', handleMessage)
    vscodeApi.postMessage(createVsCodeEvent('view.ready', {}))

    return () => window.removeEventListener('message', handleMessage)
  }, [vscodeApi])

  return graph
}

function getGraphFromMessage(message: unknown): FlowGraph | undefined {
  const graphMessageResult = parseVsCodeEvent(message, 'flowgraph')
  return graphMessageResult.isOk() ? graphMessageResult.value.payload.graph : undefined
}
