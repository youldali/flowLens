import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Position } from 'reactflow'

import { create as createEdge } from '../fixtures/react-flow-edge.ts'
import { create as createNode } from '../fixtures/react-flow-node.ts'
import { layoutDagre } from './layoutDagre.ts'

describe('layoutDagre', () => {
  it('lays out connected nodes from left to right by default', () => {
    const nodes = [
      createNode({ id: 'source', data: { label: 'source', kind: 'file', filePath: 'source.ts' } }),
      createNode({ id: 'target', data: { label: 'target', kind: 'file', filePath: 'target.ts' } }),
    ]
    const edges = [createEdge({ source: 'source', target: 'target' })]

    const laidOutNodes = layoutDagre(nodes, edges)
    const [source, target] = laidOutNodes

    assert.equal(source?.sourcePosition, Position.Right)
    assert.equal(source?.targetPosition, Position.Left)
    assert.equal(target?.sourcePosition, Position.Right)
    assert.equal(target?.targetPosition, Position.Left)
    assert.equal(source?.data, nodes[0]?.data)
    assert.equal(target?.data, nodes[1]?.data)
    assert.ok(source && target && source.position.x < target.position.x)
    assert.equal(source.position.y, target.position.y)
  })

  it('uses vertical connector positions for top-to-bottom layouts', () => {
    const nodes = [
      createNode({ id: 'source', data: { label: 'source', kind: 'file', filePath: 'source.ts' } }),
      createNode({ id: 'target', data: { label: 'target', kind: 'file', filePath: 'target.ts' } }),
    ]
    const edges = [createEdge({ source: 'source', target: 'target' })]

    const laidOutNodes = layoutDagre(nodes, edges, { direction: 'TB' })
    const [source, target] = laidOutNodes

    assert.equal(source?.sourcePosition, Position.Bottom)
    assert.equal(source?.targetPosition, Position.Top)
    assert.equal(target?.sourcePosition, Position.Bottom)
    assert.equal(target?.targetPosition, Position.Top)
    assert.ok(source && target && source.position.y < target.position.y)
    assert.equal(source.position.x, target.position.x)
  })
})
