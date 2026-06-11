import { useEffect, useState } from 'react'
import { isFlowGraph, type FlowGraph } from '@flowlens/analyzer-core'

export function useGraph(): FlowGraph | undefined {
  const [graph, setGraph] = useState<FlowGraph>()

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const nextGraph = getGraphFromMessage(event.data)

      if (nextGraph) {
        setGraph(nextGraph)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => window.removeEventListener('message', handleMessage)
  }, [])

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
