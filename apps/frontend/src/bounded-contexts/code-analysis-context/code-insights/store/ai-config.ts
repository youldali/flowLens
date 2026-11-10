import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector } from '#store/hooks.ts'
import type { AiBackend } from '../domain/ai-config'

const initialState: { backend: AiBackend } = { backend: 'openai-api' }

const aiConfigSlice = createSlice({
  name: 'ai-config',
  initialState,
  reducers: {
    selectBackend(state, action: PayloadAction<AiBackend>) {
      state.backend = action.payload
    },
  },
})

export const aiConfigReducer = aiConfigSlice.reducer

export function useAiBackend() {
  const backend = useAppSelector(state => state['ai-config'].backend)
  const dispatch = useAppDispatch()

  return {
    backend,
    selectBackend: (selectedBackend: AiBackend) => dispatch(aiConfigSlice.actions.selectBackend(selectedBackend)),
  }
}
