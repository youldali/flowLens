import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { Position } from 'reactflow'
import { getRelationshipEdgePath } from './relationshipEdgePath'

describe('getRelationshipEdgePath', () => {
  it('places fan-out labels on each destination branch with room for text and arrowheads', () => {
    for (const targetY of [-300, -150, 0, 150, 300]) {
      const { labelX, labelY, path } = getRelationshipEdgePath({
        sourceX: 0, sourceY: 0, targetX: 280, targetY,
        sourcePosition: Position.Right, targetPosition: Position.Left,
      })

      assert.equal(labelY, targetY)
      assert.ok(labelX - 44 > 145, 'label clears the central bend')
      assert.ok(labelX + 44 < 260, 'label clears the target arrow')
      assert.ok(path.endsWith(`L280 ${targetY}`))
    }
  })

  it('keeps labels near the target in reversed and vertical directions', () => {
    for (const [sourcePosition, targetPosition, targetX, targetY] of [
      [Position.Left, Position.Right, -280, 150],
      [Position.Bottom, Position.Top, 150, 280],
      [Position.Top, Position.Bottom, 150, -280],
    ] as const) {
      const { labelX, labelY } = getRelationshipEdgePath({
        sourceX: 0, sourceY: 0, targetX, targetY, sourcePosition, targetPosition,
      })

      assert.equal(Math.hypot(labelX - targetX, labelY - targetY), targetPosition === Position.Right ? 68 : 30)
      assert.ok(Math.hypot(labelX, labelY) < Math.hypot(targetX, targetY))
    }
  })

  it('lifts short horizontal labels above the nodes instead of covering the arrow or target', () => {
    for (const targetX of [0, 20, 100]) {
      const { path, labelY } = getRelationshipEdgePath({
        sourceX: 0, sourceY: 0, targetX, targetY: 0,
        sourcePosition: Position.Right, targetPosition: Position.Left,
      })

      assert.ok(Number.isFinite(labelY))
      assert.ok(labelY + 12 < -44, 'label clears the node top')
      assert.ok(!path.includes('NaN'))
    }
  })
})
