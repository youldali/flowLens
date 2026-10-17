// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import { createNode } from '@flowlens/analyzer-core/fixtures/node'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { graphFacade } from '../adapters/graphFacade'
import { GraphProvider } from './GraphProvider'
import { useGraphContext } from './useGraphContext'

afterEach(cleanup)

function HighlightProbe() {
  const highlight = graphFacade.actions.useHighlightEdge()
  const highlightedEdgeId = graphFacade.data.useHighlightedEdgeId()

  return (
    <>
      <button onClick={() => highlight('connection')}>Highlight</button>
      <output aria-label="Highlighted edge">{highlightedEdgeId ?? 'none'}</output>
    </>
  )
}

describe('GraphProvider', () => {
  it('clears the highlighted edge on graph replacement and unmount, but not ordinary rerenders', () => {
    const graph: FlowGraph = {
      nodes: [createNode({ id: 'source' }), createNode({ id: 'target' })],
      edges: [createEdge({ id: 'connection', source: 'source', target: 'target' })],
    }
    const view = render(
      <AppShell>
        <GraphProvider graphId="test-graph" graph={graph}><span>First render</span></GraphProvider>
        <HighlightProbe />
      </AppShell>,
    )
    const highlight = () => fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))
    const highlightedEdge = () => screen.getByRole('status', { name: 'Highlighted edge' }).textContent

    highlight()
    assert.equal(highlightedEdge(), 'connection')

    view.rerender(
      <AppShell>
        <GraphProvider graphId="test-graph" graph={graph} onOpenSource={vi.fn()}><span>New children</span></GraphProvider>
        <HighlightProbe />
      </AppShell>,
    )
    assert.equal(highlightedEdge(), 'connection')

    view.rerender(
      <AppShell>
        <GraphProvider graphId="replacement-graph" graph={{ ...graph }}><span>Updated graph</span></GraphProvider>
        <HighlightProbe />
      </AppShell>,
    )
    assert.equal(highlightedEdge(), 'none')

    highlight()
    assert.equal(highlightedEdge(), 'connection')
    view.rerender(<AppShell><HighlightProbe /></AppShell>)
    assert.equal(highlightedEdge(), 'none')
  })
})

function SessionProbe() {
  const context = useGraphContext()
  const graphId = graphFacade.data.useGraphId()
  const graph = graphFacade.data.useOriginalGraph()
  assert.equal(context.graphId, graphId)
  assert.equal(context.graph, graph)
  return <output aria-label="Graph session">{graphId}</output>
}

describe('GraphProvider session', () => {
  it('exposes and updates the session ID even when the graph object is reused', () => {
    const graph: FlowGraph = { nodes: [], edges: [] }
    const view = render(
      <AppShell>
        <GraphProvider graphId="first" graph={graph}><SessionProbe /></GraphProvider>
        <HighlightProbe />
      </AppShell>,
    )
    assert.equal(screen.getByRole('status', { name: 'Graph session' }).textContent, 'first')
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))
    view.rerender(
      <AppShell>
        <GraphProvider graphId="second" graph={graph}><SessionProbe /></GraphProvider>
        <HighlightProbe />
      </AppShell>,
    )
    assert.equal(screen.getByRole('status', { name: 'Graph session' }).textContent, 'second')
    assert.equal(screen.getByRole('status', { name: 'Highlighted edge' }).textContent, 'none')
  })
})
