import { configureStore } from '@reduxjs/toolkit'
import { graphReducer } from '#code-analysis-context/graph-visualization/slice/index.ts'
import { aiConfigReducer } from '#code-analysis-context/code-insights/store/ai-config.ts'

export const createAppStore = () => configureStore({
  reducer: {
    graph: graphReducer,
    'ai-config': aiConfigReducer,
  },
})

export const store = createAppStore()

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
