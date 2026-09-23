import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { createAppStore } from '@store'
import {
  DEFAULT_GRAPH_TRANSFORMER_ID,
  GRAPH_TRANSFORMER_IDS,
  transformGraph,
} from '@code-analysis-context/graph-visualization/domain/transformer'
import { selectors, actions } from './graphSlice'

describe('graphReducer', () => {
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

  it('transforms a supplied graph with the selected transformer', () => {
    const store = createAppStore()
    const graph: FlowGraph = { nodes: [], edges: [] }

    for (const transformer of GRAPH_TRANSFORMER_IDS) {
      store.dispatch(actions.selectTransformer(transformer))

      assert.deepEqual(
        selectors.selectTransformedGraph(store.getState(), graph),
        transformGraph(graph, transformer),
      )
    }
  })

  it('selects, replaces, and clears the selected node', () => {
    const store = createAppStore()

    assert.equal(selectors.selectSelectedNodeId(store.getState()), undefined)

    store.dispatch(actions.selectNode('first'))
    assert.equal(selectors.selectSelectedNodeId(store.getState()), 'first')

    store.dispatch(actions.selectNode('second'))
    assert.equal(selectors.selectSelectedNodeId(store.getState()), 'second')

    store.dispatch(actions.clearNodeSelection())
    assert.equal(selectors.selectSelectedNodeId(store.getState()), undefined)
  })
})
