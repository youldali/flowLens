import { useCallback } from 'react'
import type { NodeMouseHandler } from 'reactflow'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import type { ReactFlowAdapterOptions } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import { useGraph } from './useGraph'
import { useNodeSelection } from './useNodeSelection'
import { useReactFlowUi } from './useReactFlowUi'

interface UseGraphUiOptions {
  graph: FlowGraph
  direction: NonNullable<ReactFlowAdapterOptions['direction']>
}

export function useGraphUi({ graph, direction }: UseGraphUiOptions) {
  const { fitView, focusOnNode } = useReactFlowUi()
  const [selectedNodeId, dispatchSelection] = useNodeSelection()
  const { displayGraph, nodes, edges } = useGraph({
    graph,
    direction,
    selectedNodeId,
  })

  const selectAndFocusNode = useCallback((nodeId: NodeId) => {
    dispatchSelection({ type: 'select', nodeId })
    window.requestAnimationFrame(() => focusOnNode(nodeId))
  }, [dispatchSelection, focusOnNode])

  const selectNode: NodeMouseHandler = useCallback((_event, node) => {
    dispatchSelection({ type: 'select', nodeId: node.id })
  }, [dispatchSelection])

  const clearSelection = useCallback(() => {
    dispatchSelection({ type: 'clear' })
  }, [dispatchSelection])

  return {
    displayGraph,
    nodes,
    edges,
    selectedNodeId,
    fitView,
    focusOnNode,
    selectAndFocusNode,
    selectNode,
    clearSelection,
  }
}
