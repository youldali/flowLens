import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import {
  createCallExpressionNode,
  createNode,
} from '@flowlens/analyzer-core/fixtures/node'
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

  it('returns the flow graph when the selected transformer is flow', () => {
    const caller = createNode({ id: 'caller', name: 'caller' })
    const call = createCallExpressionNode({ id: 'call' })
    const declaration = createNode({ id: 'declaration', name: 'callee' })
    const result = transformGraph({
      nodes: [caller, call, declaration],
      edges: [
        createEdge({
          id: 'caller->call:calls',
          source: caller.id,
          target: call.id,
          type: 'calls',
        }),
        createEdge({
          id: 'call->declaration:references',
          source: call.id,
          target: declaration.id,
          type: 'references',
        }),
      ],
    }, 'flow')

    assert.deepEqual(
      result.nodes.map((node) => node.id),
      ['caller', 'declaration'],
    )
    assert.deepEqual(
      result.edges.map((edge) => [edge.source, edge.target, edge.type]),
      [['caller', 'declaration', 'calls']],
    )
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
