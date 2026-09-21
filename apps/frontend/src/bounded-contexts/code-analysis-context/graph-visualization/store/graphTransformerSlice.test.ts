import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { createAppStore } from '@store'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
  GRAPH_TRANSFORMER_IDS,
} from '@code-analysis-context/graph-visualization/domain/transformer'
import { selectors, actions } from './graphTransformerSlice'

describe('graphTransformerReducer', () => {
  it('uses the domain default and supports every selection, including repeated selections', () => {
    const store = createAppStore()

    assert.equal(selectors.selectSelectedTransformer(store.getState()), DEFAULT_GRAPH_TRANSFORMER_ID)

    for (const transformer of GRAPH_TRANSFORMER_IDS) {
      store.dispatch(actions.selectTransformer(transformer))
      assert.equal(selectors.selectSelectedTransformer(store.getState()), transformer)
      store.dispatch(actions.selectTransformer(transformer))
      assert.equal(selectors.selectSelectedTransformer(store.getState()), transformer)
    }

    store.dispatch(actions.selectTransformer('none'))
    assert.equal(selectors.selectSelectedTransformer(createAppStore().getState()), DEFAULT_GRAPH_TRANSFORMER_ID)
  })
})
