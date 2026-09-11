import { useCallback } from 'react'
import { useReactFlow } from 'reactflow'
import type { NodeId } from '@flowlens/analyzer-core/node'

const DEFAULT_NODE_WIDTH = 224
const DEFAULT_NODE_HEIGHT = 88

export function useReactFlowUi() {
  const { fitView, getNode, getZoom, setCenter } = useReactFlow()

  const focusOnNode = useCallback((nodeId: NodeId) => {
    const node = getNode(nodeId)

    if (!node) {
      return
    }

    void setCenter(
      node.position.x + (node.width ?? DEFAULT_NODE_WIDTH) / 2,
      node.position.y + (node.height ?? DEFAULT_NODE_HEIGHT) / 2,
      { zoom: getZoom(), duration: 300 },
    )
  }, [getNode, getZoom, setCenter])

  return { fitView, focusOnNode }
}
