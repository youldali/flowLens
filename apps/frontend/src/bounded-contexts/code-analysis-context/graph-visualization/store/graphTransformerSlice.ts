import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
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

export const selectors = {
  selectSelectedTransformer: (
    state: { graphTransformer: GraphTransformerState },
  ): GraphTransformerId => state.graphTransformer.selectedTransformer,
}
