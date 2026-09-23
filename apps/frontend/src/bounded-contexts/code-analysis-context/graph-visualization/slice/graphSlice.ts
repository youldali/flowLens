import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  findNodeInGraphById,
  type FlowGraph,
} from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
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
  direction: LayoutDirection
}

const DEFAULT_LAYOUT_DIRECTION = 'LR' satisfies LayoutDirection

const initialState: GraphState = {
  selectedTransformer: DEFAULT_GRAPH_TRANSFORMER_ID,
  selectedNodeId: undefined,
  direction: DEFAULT_LAYOUT_DIRECTION,
}

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    selectTransformer(state, action: PayloadAction<GraphTransformerId>) {
      state.selectedTransformer = action.payload
    },
    selectNode(state, action: PayloadAction<NodeId>) {
      state.selectedNodeId = action.payload
    },
    clearNodeSelection(state) {
      state.selectedNodeId = undefined
    },
    selectDirection(state, action: PayloadAction<LayoutDirection>) {
      state.direction = action.payload
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

export const selectors = {
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
