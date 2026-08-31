import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import { createNode } from '@flowlens/analyzer-core/fixtures/node'
import { transformGraph } from './transformer'

const projectNode = createNode({
  id: 'project-node',
  name: 'project.ts',
  sourceOrigin: 'project',
})
const externalNode = createNode({
  id: 'external-node',
  name: 'external.ts',
  sourceOrigin: 'external',
})
const unknownNode = createNode({
  id: 'unknown-node',
  name: 'unknown.ts',
  sourceOrigin: 'unknown',
})

const graph: FlowGraph = {
  nodes: [projectNode, externalNode, unknownNode],
  edges: [
    createEdge({
      id: 'project-node->external-node:imports',
      source: 'project-node',
      target: 'external-node',
      type: 'imports',
    }),
    createEdge({
      id: 'project-node->unknown-node:imports',
      source: 'project-node',
      target: 'unknown-node',
      type: 'imports',
    }),
  ],
}

describe('transformGraph', () => {
  it('returns the original graph when the selected transformer is none', () => {
    const result = transformGraph(graph, 'none')

    assert.equal(result, graph)
  })

  it('returns the project source graph when the selected transformer is projectSource', () => {
    const result = transformGraph(graph, 'projectSource')

    assert.deepEqual(
      result.nodes.map((node) => node.id),
      ['project-node', 'unknown-node'],
    )
    assert.deepEqual(
      result.edges.map((edge) => edge.id),
      ['project-node->unknown-node:imports'],
    )
  })
})
