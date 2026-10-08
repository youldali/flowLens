import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  findNodeInGraphById,
  type FlowGraph,
} from '@flowlens/analyzer-core/domain/flow-graph'
import type { EdgeId } from '@flowlens/analyzer-core/domain/edge'
import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import {
  adaptToReactFlow,
  type LayoutDirection,
} from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
  transformGraph,
  type GraphTransformerId,
} from '@code-analysis-context/graph-visualization/domain/transformer'

export interface GraphState {
  selectedTransformer: GraphTransformerId
  selectedNodeId: NodeId | undefined
  highlightedEdgeId: EdgeId | undefined
  direction: LayoutDirection
}

const DEFAULT_LAYOUT_DIRECTION = 'LR' satisfies LayoutDirection

const initialState: GraphState = {
  selectedTransformer: DEFAULT_GRAPH_TRANSFORMER_ID,
  selectedNodeId: undefined,
  highlightedEdgeId: undefined,
  direction: DEFAULT_LAYOUT_DIRECTION,
}

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    selectTransformer(state, action: PayloadAction<GraphTransformerId>) {
      state.selectedTransformer = action.payload
      state.highlightedEdgeId = undefined
    },
    selectNode(state, action: PayloadAction<NodeId>) {
      state.selectedNodeId = action.payload
    },
    clearNodeSelection(state) {
      state.selectedNodeId = undefined
    },
    highlightEdge(state, action: PayloadAction<EdgeId>) {
      state.highlightedEdgeId = action.payload
    },
    clearHighlightedEdge(state, action: PayloadAction<EdgeId | undefined>) {
      // A delayed leave from an old edge must not clear a newer highlight.
      if (action.payload === undefined || state.highlightedEdgeId === action.payload) {
        state.highlightedEdgeId = undefined
      }
    },
    selectDirection(state, action: PayloadAction<LayoutDirection>) {
      state.direction = action.payload
      state.highlightedEdgeId = undefined
    },
  },
})

export const actions = graphSlice.actions
export const graphReducer = graphSlice.reducer

type GraphRootState = {
  graph: GraphState
}

const selectSelectedTransformer = (
  state: GraphRootState,
): GraphTransformerId => state.graph.selectedTransformer

const selectSelectedNodeId = (
  state: GraphRootState,
): NodeId | undefined => state.graph.selectedNodeId

const selectHighlightedEdgeId = (
  state: GraphRootState,
): EdgeId | undefined => state.graph.highlightedEdgeId

const selectDirection = (
  state: GraphRootState,
): LayoutDirection => state.graph.direction

const selectGraph = (
  _state: GraphRootState,
  graph: FlowGraph,
): FlowGraph => graph

const selectTransformedGraph = createSelector(
  [selectSelectedTransformer, selectGraph],
  (selectedTransformer, graph) => transformGraph(graph, selectedTransformer),
)

const selectHighlightedEdge = createSelector(
  [selectTransformedGraph, selectHighlightedEdgeId],
  (graph, highlightedEdgeId) => graph.edges.find(edge => edge.id === highlightedEdgeId),
)

export const selectors = {
  selectHighlightedEdgeId,
  selectHighlightedEdge,
  selectSelectedTransformer,
  selectSelectedNodeId,
  selectDirection,
  selectTransformedGraph,
  selectSelectedNode: createSelector(
    [selectTransformedGraph, selectSelectedNodeId],
    (graph, selectedNodeId) => selectedNodeId
      ? findNodeInGraphById(graph, selectedNodeId)
      : undefined,
  ),
  selectReactFlowGraph: createSelector(
    [selectGraph, selectDirection, selectSelectedNodeId],
    (graph, direction, selectedNodeId) => adaptToReactFlow(graph, {
      direction,
      selectedNodeId,
    }),
  ),
}
