// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { AppShell } from '@common/test-utils/appShell'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import type { LayoutDirection } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import { GraphDirectionSelector } from './GraphDirectionSelector'

const translations: Record<string, string> = {
  'graphVisualization.directions.label': 'Direction',
  'graphVisualization.directions.options.leftToRight': 'Left to right',
  'graphVisualization.directions.options.topToBottom': 'Top to bottom',
}

vi.mock('@common/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => translations[key] ?? key }),
}))

afterEach(cleanup)

function SelectedDirection() {
  const direction = graphFacade.data.useDirection()

  return <output aria-label="Selected direction">{direction}</output>
}

describe('GraphDirectionSelector', () => {
  it('selects every direction and preserves the selection across remounts', () => {
    const consumers = (
      <AppShell>
        <GraphDirectionSelector />
        <SelectedDirection />
      </AppShell>
    )
    const view = render(consumers)
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Direction' })

    assert.deepEqual(screen.getAllByRole<HTMLOptionElement>('option').map(option => option.value), ['LR', 'TB'])
    assert.equal(select.value, 'LR')
    assert.equal(screen.getByRole('status').textContent, 'LR')

    const directions = [
      ['LR', 'Left to right'],
      ['TB', 'Top to bottom'],
    ] as const satisfies readonly [LayoutDirection, string][]

    for (const [direction, label] of directions) {
      assert.ok(screen.getByRole('option', { name: label }))
      fireEvent.change(select, { target: { value: direction } })
      assert.equal(select.value, direction)
      assert.equal(screen.getByRole('status').textContent, direction)
    }

    view.rerender(<AppShell />)
    view.rerender(consumers)
    assert.equal(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Direction' }).value,
      'TB',
    )
  })
})
