import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Position } from 'reactflow'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

import { adaptToReactFlow } from './index.ts'

describe('adaptToReactFlow', () => {
  it('maps the graph to React Flow elements and applies layout', () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: 'src/index.ts',
          kind: 'file',
          name: 'index.ts',
          filePath: 'src/index.ts',
          sourceOrigin: 'project',
        },
        {
          id: 'src/index.ts:1:12',
          kind: 'functionDeclaration',
          name: 'main',
          filePath: 'src/index.ts',
          sourceOrigin: 'project',
        },
      ],
      edges: [
        {
          id: 'src/index.ts->src/index.ts:1:12:declares',
          source: 'src/index.ts',
          target: 'src/index.ts:1:12',
          type: 'declares',
        },
      ],
    }

    const { nodes, edges } = adaptToReactFlow(graph, { direction: 'TB' })
    const [source, target] = nodes

    assert.equal(edges.length, 1)
    assert.equal(source?.sourcePosition, Position.Bottom)
    assert.equal(source?.targetPosition, Position.Top)
    assert.equal(target?.sourcePosition, Position.Bottom)
    assert.equal(target?.targetPosition, Position.Top)
    assert.equal(source?.data.label, 'index.ts')
    assert.equal(target?.data.label, 'main')
    assert.ok(source && target && source.position.y < target.position.y)
  })
})
