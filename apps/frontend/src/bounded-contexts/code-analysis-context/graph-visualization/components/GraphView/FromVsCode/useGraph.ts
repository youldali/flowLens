import { useEffect, useState } from 'react'
import { useVsCodeApi } from '@common/hooks/useVsCodeApi'
import { isFlowGraph, type FlowGraph } from '@flowlens/analyzer-core/flow-graph-contract'

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
    vscodeApi.postMessage({ type: 'flowlens.ready' })

    return () => window.removeEventListener('message', handleMessage)
  }, [vscodeApi])

  return graph
}

function getGraphFromMessage(message: unknown): FlowGraph | undefined {
  if (isFlowGraph(message)) {
    return message
  }

  return isMessageWithGraph(message) ? message.graph : undefined
}

function isMessageWithGraph(message: unknown): message is { graph: FlowGraph } {
  return (
    typeof message === 'object'
    && message !== null
    && 'graph' in message
    && isFlowGraph(message.graph)
  )
}
