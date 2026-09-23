// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import { AppShell } from '@common/test-utils/appShell'
import { useNodeSelection } from './useNodeSelection'

afterEach(cleanup)

function NodeSelection() {
  const { selectedNodeId, selectNode } = useNodeSelection()

  return (
    <>
      <output aria-label="Selected node">{selectedNodeId ?? 'none'}</output>
      <button onClick={() => selectNode('selected')} type="button">Select node</button>
    </>
  )
}

describe('useNodeSelection', () => {
  it('selects nodes and clears selection on Escape and unmount', () => {
    const consumers = (
      <AppShell>
        <NodeSelection />
      </AppShell>
    )
    const view = render(consumers)
    const selectedNode = () => screen.getByRole('status').textContent

    assert.equal(selectedNode(), 'none')
    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))
    assert.equal(selectedNode(), 'selected')

    fireEvent.keyDown(window, { key: 'Enter' })
    assert.equal(selectedNode(), 'selected')
    fireEvent.keyDown(window, { key: 'Escape' })
    assert.equal(selectedNode(), 'none')

    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))
    view.rerender(<AppShell />)
    view.rerender(consumers)
    assert.equal(selectedNode(), 'none')
  })
})
