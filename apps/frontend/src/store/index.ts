import { configureStore } from '@reduxjs/toolkit'
import { graphReducer } from '#code-analysis-context/graph-visualization/slice/index.ts'

export const createAppStore = () => configureStore({
  reducer: {
    graph: graphReducer,
  },
})

export const store = createAppStore()

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
