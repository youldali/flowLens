import { useCallback } from 'react'
import type { NodeMouseHandler } from 'reactflow'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import { selectors } from '@code-analysis-context/graph-visualization/slice'
import { useAppSelector } from '@store/hooks'
import { useNodeSelection } from './useNodeSelection'
import { useReactFlowUi } from './useReactFlowUi'

interface UseGraphUiOptions {
  graph: FlowGraph
}

export function useGraphUi({ graph }: UseGraphUiOptions) {
  const { fitView, focusOnNode } = useReactFlowUi()
  const {
    selectedNodeId,
    selectNode: selectNodeById,
    clearSelection,
  } = useNodeSelection()
  const { nodes, edges } = useAppSelector((state) =>
    selectors.selectReactFlowGraph(state, graph),
  )

  const selectAndFocusNode = useCallback((nodeId: NodeId) => {
    selectNodeById(nodeId)
    window.requestAnimationFrame(() => focusOnNode(nodeId))
  }, [focusOnNode, selectNodeById])

  const selectNode: NodeMouseHandler = useCallback((_event, node) => {
    selectNodeById(node.id)
  }, [selectNodeById])

  return {
    displayGraph: graph,
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
