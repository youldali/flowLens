// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { render, screen } from '@testing-library/react'
import { describe, it, vi } from 'vitest'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { graphFacade } from '#code-analysis-context/graph-visualization/adapters/graphFacade.ts'
import { FromCli } from './FromCli'

const { session } = vi.hoisted(() => ({
  session: { graphId: 'backend-graph-id', graph: { nodes: [], edges: [] } },
}))

vi.mock('#common/hooks/useTranslation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('#code-analysis-context/graph-visualization/apis/fetchGraph.ts', () => ({
  useFetchGraph: () => ({ status: 'success', data: session }),
}))
vi.mock('./GraphViewContent', () => ({
  GraphViewContent: () => <output aria-label="Graph ID">{graphFacade.data.useGraphId()}</output>,
}))

describe('FromCli', () => {
  it('passes the backend graph ID through to graph context on each response', () => {
    const view = render(<AppShell><FromCli /></AppShell>)

    assert.equal(screen.getByLabelText('Graph ID').textContent, 'backend-graph-id')
    session.graphId = 'next-backend-graph-id'
    view.rerender(<AppShell><FromCli /></AppShell>)
    assert.equal(screen.getByLabelText('Graph ID').textContent, 'next-backend-graph-id')
  })
})
