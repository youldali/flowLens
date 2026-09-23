import { useCallback, useEffect } from 'react'
import {
  useReactFlow,
  type FitViewOptions,
  type NodeMouseHandler,
} from 'reactflow'
import type { NodeId } from '@flowlens/analyzer-core/node'
import type { LayoutDirection } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import { useGraphContext } from '@code-analysis-context/graph-visualization/context'
import type { GraphTransformerId } from '@code-analysis-context/graph-visualization/domain/transformer'
import {
  actions,
  selectors,
} from '@code-analysis-context/graph-visualization/slice'
import { useAppDispatch, useAppSelector } from '@store/hooks'

const DEFAULT_NODE_WIDTH = 224
const DEFAULT_NODE_HEIGHT = 88

function useSelectTransformer() {
  const dispatch = useAppDispatch()

  return useCallback((transformer: GraphTransformerId) => {
    dispatch(actions.selectTransformer(transformer))
  }, [dispatch])
}

function useSelectDirection() {
  const dispatch = useAppDispatch()

  return useCallback((direction: LayoutDirection) => {
    dispatch(actions.selectDirection(direction))
  }, [dispatch])
}

function useSelectNode(): NodeMouseHandler {
  const dispatch = useAppDispatch()

  return useCallback((_event, node) => {
    dispatch(actions.selectNode(node.id))
  }, [dispatch])
}

function useSelectNodeById() {
  const dispatch = useAppDispatch()

  return useCallback((nodeId: NodeId) => {
    dispatch(actions.selectNode(nodeId))
  }, [dispatch])
}

function useClearSelection() {
  const dispatch = useAppDispatch()

  return useCallback(() => {
    dispatch(actions.clearNodeSelection())
  }, [dispatch])
}

function useFocusOnNode() {
  const { getNode, getZoom, setCenter } = useReactFlow()

  return useCallback((nodeId: NodeId) => {
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
}

function useFitView() {
  const { fitView } = useReactFlow()

  return useCallback((options?: FitViewOptions) => fitView(options), [fitView])
}

function useSelectAndFocusNode() {
  const selectNode = useSelectNodeById()
  const focusOnNode = useFocusOnNode()

  return useCallback((nodeId: NodeId) => {
    selectNode(nodeId)
    window.requestAnimationFrame(() => focusOnNode(nodeId))
  }, [focusOnNode, selectNode])
}

function useSelectionCleanup() {
  const clearSelection = useClearSelection()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      clearSelection()
    }
  }, [clearSelection])
}

function useOriginalGraph() {
  return useGraphContext().graph
}

function useTransformedGraph() {
  const graph = useOriginalGraph()

  return useAppSelector((state) => selectors.selectTransformedGraph(state, graph))
}

function useReactFlowGraph() {
  const graph = useTransformedGraph()

  return useAppSelector((state) => selectors.selectReactFlowGraph(state, graph))
}

function useSelectedTransformer() {
  return useAppSelector(selectors.selectSelectedTransformer)
}

function useSelectedNodeId() {
  return useAppSelector(selectors.selectSelectedNodeId)
}

function useDirection() {
  return useAppSelector(selectors.selectDirection)
}

function useOnOpenSource() {
  return useGraphContext().onOpenSource
}

export const graphFacade = {
  actions: {
    useSelectTransformer,
    useSelectDirection,
    useSelectNode,
    useClearSelection,
    useSelectAndFocusNode,
    useFocusOnNode,
    useFitView,
    useSelectionCleanup,
  },
  data: {
    useOriginalGraph,
    useTransformedGraph,
    useReactFlowGraph,
    useSelectedTransformer,
    useSelectedNodeId,
    useDirection,
    useOnOpenSource,
  },
}
