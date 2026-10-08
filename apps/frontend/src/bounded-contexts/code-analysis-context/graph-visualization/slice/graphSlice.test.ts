import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import { createNode } from '@flowlens/analyzer-core/fixtures/node'
import { createAppStore } from '@store'
import { adaptToReactFlow } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
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

  it('returns the selected node from the transformed graph', () => {
    const store = createAppStore()
    const node = createNode({ id: 'selected' })
    const graph: FlowGraph = { nodes: [node], edges: [] }

    store.dispatch(actions.selectTransformer('none'))
    assert.equal(selectors.selectSelectedNode(store.getState(), graph), undefined)

    store.dispatch(actions.selectNode(node.id))
    assert.equal(selectors.selectSelectedNode(store.getState(), graph), node)

    store.dispatch(actions.selectNode('missing'))
    assert.equal(selectors.selectSelectedNode(store.getState(), graph), undefined)
  })

  it('uses the default layout direction and supports every direction', () => {
    const store = createAppStore()

    assert.equal(selectors.selectDirection(store.getState()), 'LR')

    for (const direction of ['TB', 'LR'] as const) {
      store.dispatch(actions.selectDirection(direction))
      assert.equal(selectors.selectDirection(store.getState()), direction)
    }
  })

  it('adapts a supplied graph using the selected direction and node', () => {
    const store = createAppStore()
    const graph: FlowGraph = {
      nodes: [
        createNode({ id: 'source', name: 'source' }),
        createNode({ id: 'target', name: 'target' }),
      ],
      edges: [createEdge({
        id: 'source->target:calls',
        source: 'source',
        target: 'target',
      })],
    }

    for (const direction of ['TB', 'LR'] as const) {
      store.dispatch(actions.selectDirection(direction))
      assert.deepEqual(
        selectors.selectReactFlowGraph(store.getState(), graph),
        adaptToReactFlow(graph, { direction }),
      )
    }

    store.dispatch(actions.selectNode('target'))
    assert.deepEqual(
      selectors.selectReactFlowGraph(store.getState(), graph),
      adaptToReactFlow(graph, { direction: 'LR', selectedNodeId: 'target' }),
    )
  })

  it('stores the highlighted edge independently of selection and ignores stale delayed clears', () => {
    const store = createAppStore()
    const graph: FlowGraph = { nodes: [createNode({ id: 'selected' })], edges: [] }

    assert.equal(selectors.selectHighlightedEdgeId(store.getState()), undefined)
    store.dispatch(actions.selectNode('selected'))
    const layout = selectors.selectReactFlowGraph(store.getState(), graph)

    store.dispatch(actions.highlightEdge('first'))
    assert.equal(selectors.selectHighlightedEdgeId(store.getState()), 'first')
    store.dispatch(actions.highlightEdge('second'))
    store.dispatch(actions.clearHighlightedEdge('first'))
    assert.equal(selectors.selectHighlightedEdgeId(store.getState()), 'second')
    assert.equal(selectors.selectSelectedNodeId(store.getState()), 'selected')
    assert.equal(selectors.selectReactFlowGraph(store.getState(), graph), layout)

    store.dispatch(actions.clearHighlightedEdge('second'))
    assert.equal(selectors.selectHighlightedEdgeId(store.getState()), undefined)
    store.dispatch(actions.highlightEdge('first'))
    store.dispatch(actions.clearHighlightedEdge())
    assert.equal(selectors.selectHighlightedEdgeId(store.getState()), undefined)
  })

  it('returns the highlighted edge and ignores edges missing from the graph', () => {
    const store = createAppStore()
    const graph: FlowGraph = {
      nodes: ['source', 'target', 'other'].map(id => createNode({ id })),
      edges: [createEdge({ id: 'connection', source: 'source', target: 'target' })],
    }

    store.dispatch(actions.selectTransformer('none'))
    store.dispatch(actions.highlightEdge('connection'))
    assert.equal(selectors.selectHighlightedEdge(store.getState(), graph), graph.edges[0])

    store.dispatch(actions.highlightEdge('missing'))
    assert.equal(selectors.selectHighlightedEdge(store.getState(), graph), undefined)
  })

  it('clears the highlighted edge when selecting a transformer or direction while preserving node selection', () => {
    const store = createAppStore()

    store.dispatch(actions.selectNode('selected'))

    for (const action of [actions.selectTransformer('none'), actions.selectDirection('TB')]) {
      store.dispatch(actions.highlightEdge('connection'))
      store.dispatch(action)
      assert.equal(selectors.selectHighlightedEdgeId(store.getState()), undefined)
      assert.equal(selectors.selectSelectedNodeId(store.getState()), 'selected')
    }

    assert.equal(selectors.selectSelectedTransformer(store.getState()), 'none')
    assert.equal(selectors.selectDirection(store.getState()), 'TB')
  })
})
