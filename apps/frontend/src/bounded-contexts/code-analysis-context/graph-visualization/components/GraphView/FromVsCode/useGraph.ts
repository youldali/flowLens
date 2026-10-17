import { useEffect, useState } from 'react'
import { useVsCodeApi } from '@common/hooks/useVsCodeApi'
import type { GraphSession } from '@flowlens/analyzer-core/domain/graph-session'
import { createVsCodeEvent, parseVsCodeEvent } from '@flowlens/registries/vscode-events'

export function useGraph(): GraphSession | undefined {
  const [graph, setGraph] = useState<GraphSession>()
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

function getGraphFromMessage(message: unknown): GraphSession | undefined {
  const graphMessageResult = parseVsCodeEvent(message, 'flowgraph')
  return graphMessageResult.isOk() ? graphMessageResult.value.payload : undefined
}
