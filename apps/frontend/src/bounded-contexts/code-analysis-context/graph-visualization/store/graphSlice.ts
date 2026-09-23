import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
  transformGraph,
  type GraphTransformerId,
} from '@code-analysis-context/graph-visualization/domain/transformer'

export interface GraphState {
  selectedTransformer: GraphTransformerId
  selectedNodeId: NodeId | undefined
}

const initialState: GraphState = {
  selectedTransformer: DEFAULT_GRAPH_TRANSFORMER_ID,
  selectedNodeId: undefined,
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

const selectGraph = (
  _state: GraphRootState,
  graph: FlowGraph,
): FlowGraph => graph

export const selectors = {
  selectSelectedTransformer,
  selectSelectedNodeId,
  selectTransformedGraph: createSelector(
    [selectSelectedTransformer, selectGraph],
    (selectedTransformer, graph) => transformGraph(graph, selectedTransformer),
  ),
}
