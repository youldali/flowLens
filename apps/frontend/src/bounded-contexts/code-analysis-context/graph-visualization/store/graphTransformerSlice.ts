import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
  transformGraph,
  type GraphTransformerId,
} from '@code-analysis-context/graph-visualization/domain/transformer'

export interface GraphTransformerState {
  selectedTransformer: GraphTransformerId
}

const initialState: GraphTransformerState = {
  selectedTransformer: DEFAULT_GRAPH_TRANSFORMER_ID,
}

const graphTransformerSlice = createSlice({
  name: 'graphTransformer',
  initialState,
  reducers: {
    selectTransformer(state, action: PayloadAction<GraphTransformerId>) {
      state.selectedTransformer = action.payload
    },
  },
})

export const actions = graphTransformerSlice.actions
export const graphTransformerReducer = graphTransformerSlice.reducer

type GraphTransformerRootState = {
  graphTransformer: GraphTransformerState
}

const selectSelectedTransformer = (
  state: GraphTransformerRootState,
): GraphTransformerId => state.graphTransformer.selectedTransformer

const selectGraph = (
  _state: GraphTransformerRootState,
  graph: FlowGraph,
): FlowGraph => graph

export const selectors = {
  selectSelectedTransformer,
  selectTransformedGraph: createSelector(
    [selectSelectedTransformer, selectGraph],
    (selectedTransformer, graph) => transformGraph(graph, selectedTransformer),
  ),
}
