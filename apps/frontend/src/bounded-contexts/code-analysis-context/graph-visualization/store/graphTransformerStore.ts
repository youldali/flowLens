import { create } from 'zustand'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
  type GraphTransformerId,
} from '@code-analysis-context/graph-visualization/domain/transformer'

interface GraphTransformerState {
  selectedTransformer: GraphTransformerId
  selectTransformer: (transformer: GraphTransformerId) => void
}

export const useGraphTransformerStore = create<GraphTransformerState>((set) => ({
  selectedTransformer: DEFAULT_GRAPH_TRANSFORMER_ID,
  selectTransformer: (selectedTransformer) => set({ selectedTransformer }),
}))
