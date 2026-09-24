// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import type { Node } from 'reactflow'
import { AppShell } from '@common/test-utils/appShell'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'

import { useEffectSelectionCleanup } from './useEffectSelectionCleanup'

afterEach(cleanup)

function Probe() {
  const selectedNodeId = graphFacade.data.useSelectedNodeId()
  const selectNode = graphFacade.actions.useSelectNodeMouseHandler()
  useEffectSelectionCleanup()

  return (
    <>
      <output aria-label="Selected node ID">{selectedNodeId ?? 'none'}</output>
      <button
        onClick={(event) => selectNode(event, { id: 'first' } as Node)}
        type="button"
      >
        Select node
      </button>
    </>
  )
}

describe('useEffectSelectionCleanup', () => {
  it('clears selection on Escape and unmount', () => {
    const probe = <Probe />
    const view = render(<AppShell>{probe}</AppShell>)

    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))
    fireEvent.keyDown(window, { key: 'Enter' })
    assert.equal(screen.getByRole('status', { name: 'Selected node ID' }).textContent, 'first')

    fireEvent.keyDown(window, { key: 'Escape' })
    assert.equal(screen.getByRole('status', { name: 'Selected node ID' }).textContent, 'none')

    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))
    view.rerender(<AppShell />)
    view.rerender(<AppShell>{probe}</AppShell>)
    assert.equal(screen.getByRole('status', { name: 'Selected node ID' }).textContent, 'none')
  })
})
