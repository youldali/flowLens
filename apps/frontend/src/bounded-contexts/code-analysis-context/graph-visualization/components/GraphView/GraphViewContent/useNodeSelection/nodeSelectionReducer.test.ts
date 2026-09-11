import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  getNodeSelectionKeyboardAction,
  reduceNodeSelection,
} from './nodeSelectionReducer'

describe('reduceNodeSelection', () => {
  it('opens, replaces, and closes the active node selection', () => {
    const opened = reduceNodeSelection(undefined, { type: 'select', nodeId: 'first' })
    const replaced = reduceNodeSelection(opened, { type: 'select', nodeId: 'second' })
    const closed = reduceNodeSelection(replaced, { type: 'clear' })

    assert.equal(opened, 'first')
    assert.equal(replaced, 'second')
    assert.equal(closed, undefined)
  })
})

describe('getNodeSelectionKeyboardAction', () => {
  it('clears selection only for Escape', () => {
    assert.deepEqual(getNodeSelectionKeyboardAction('Escape'), { type: 'clear' })
    assert.equal(getNodeSelectionKeyboardAction('Enter'), undefined)
  })
})
