// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import { createNode } from '@flowlens/analyzer-core/fixtures/node'
import type { Node } from 'reactflow'
import { AppShell } from '@common/test-utils/appShell'
import { GraphProvider } from '@code-analysis-context/graph-visualization/context'
import { transformGraph } from '@code-analysis-context/graph-visualization/domain/transformer'

import { graphFacade } from './graphFacade'

const reactFlow = vi.hoisted(() => ({
  fitView: vi.fn(() => Promise.resolve(true)),
  getNode: vi.fn(),
  getZoom: vi.fn(() => 1.5),
  setCenter: vi.fn(() => Promise.resolve()),
}))

vi.mock('reactflow', async (importOriginal) => ({
  ...await importOriginal<typeof import('reactflow')>(),
  useReactFlow: () => reactFlow,
}))

const graph: FlowGraph = {
  nodes: [
    createNode({ id: 'first', sourceOrigin: 'project' }),
    createNode({ id: 'second', sourceOrigin: 'external' }),
  ],
  edges: [
    createEdge({ id: 'connected', source: 'first', target: 'second' }),
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  reactFlow.getZoom.mockReturnValue(1.5)
})

function DataProbe() {
  const originalGraph = graphFacade.data.useOriginalGraph()
  const transformedGraph = graphFacade.data.useTransformedGraph()
  const reactFlowGraph = graphFacade.data.useReactFlowGraph()
  const selectedTransformer = graphFacade.data.useSelectedTransformer()
  const selectedNodeId = graphFacade.data.useSelectedNodeId()
  const direction = graphFacade.data.useDirection()
  const onOpenSource = graphFacade.data.useOnOpenSource()

  return (
    <>
      <output aria-label="Original graph">{JSON.stringify(originalGraph)}</output>
      <output aria-label="Transformed graph">{JSON.stringify(transformedGraph)}</output>
      <output aria-label="React Flow graph">{JSON.stringify(reactFlowGraph)}</output>
      <output aria-label="Selected transformer">{selectedTransformer}</output>
      <output aria-label="Selected node">{selectedNodeId ?? 'none'}</output>
      <output aria-label="Direction">{direction}</output>
      <output aria-label="Open source">{onOpenSource ? 'available' : 'missing'}</output>
    </>
  )
}

function ActionProbe() {
  const selectTransformer = graphFacade.actions.useSelectTransformer()
  const selectDirection = graphFacade.actions.useSelectDirection()
  const selectNode = graphFacade.actions.useSelectNode()
  const clearSelection = graphFacade.actions.useClearSelection()
  const selectAndFocusNode = graphFacade.actions.useSelectAndFocusNode()
  const focusOnNode = graphFacade.actions.useFocusOnNode()
  const fitView = graphFacade.actions.useFitView()
  graphFacade.actions.useSelectionCleanup()

  return (
    <>
      <button onClick={() => selectTransformer('none')} type="button">Select transformer</button>
      <button onClick={() => selectDirection('TB')} type="button">Select direction</button>
      <button
        onClick={(event) => selectNode(event, { id: 'first' } as Node)}
        type="button"
      >
        Select node
      </button>
      <button onClick={clearSelection} type="button">Clear selection</button>
      <button onClick={() => selectAndFocusNode('first')} type="button">
        Select and focus node
      </button>
      <button onClick={() => focusOnNode('first')} type="button">Focus node</button>
      <button onClick={() => focusOnNode('missing')} type="button">Focus missing node</button>
      <button onClick={() => void fitView({ padding: 0.25 })} type="button">Fit view</button>
    </>
  )
}

function FacadeConsumer() {
  return (
    <>
      <DataProbe />
      <ActionProbe />
    </>
  )
}

function renderFacade(onOpenSource = vi.fn()) {
  const consumers = (
    <AppShell>
      <GraphProvider graph={graph} onOpenSource={onOpenSource}>
        <FacadeConsumer />
      </GraphProvider>
    </AppShell>
  )

  return { consumers, view: render(consumers) }
}

function output(label: string) {
  return screen.getByRole('status', { name: label }).textContent
}

describe('graphFacade', () => {
  it('exposes context and Redux graph data and updates every Redux setting', () => {
    renderFacade()

    assert.deepEqual(JSON.parse(output('Original graph') ?? ''), graph)
    assert.deepEqual(
      JSON.parse(output('Transformed graph') ?? ''),
      transformGraph(graph, 'projectSource'),
    )
    assert.equal(output('Selected transformer'), 'projectSource')
    assert.equal(output('Selected node'), 'none')
    assert.equal(output('Direction'), 'LR')
    assert.equal(output('Open source'), 'available')

    fireEvent.click(screen.getByRole('button', { name: 'Select transformer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select direction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))

    assert.equal(output('Selected transformer'), 'none')
    assert.deepEqual(JSON.parse(output('Transformed graph') ?? ''), graph)
    assert.equal(output('Selected node'), 'first')
    assert.equal(output('Direction'), 'TB')
    assert.equal(
      JSON.parse(output('React Flow graph') ?? '').nodes
        .find((node: Node) => node.id === 'first').selected,
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    assert.equal(output('Selected node'), 'none')
  })

  it('clears selection on Escape and unmount', () => {
    const { consumers, view } = renderFacade()

    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))
    fireEvent.keyDown(window, { key: 'Enter' })
    assert.equal(output('Selected node'), 'first')

    fireEvent.keyDown(window, { key: 'Escape' })
    assert.equal(output('Selected node'), 'none')

    fireEvent.click(screen.getByRole('button', { name: 'Select node' }))
    view.rerender(<AppShell />)
    view.rerender(consumers)
    assert.equal(output('Selected node'), 'none')
  })

  it('delegates focus and fit-view interactions to React Flow', () => {
    let animationFrame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrame = callback
      return 1
    })
    reactFlow.getNode.mockImplementation((nodeId) => nodeId === 'first'
      ? {
          id: 'first',
          data: {},
          position: { x: 10, y: 20 },
          width: 100,
          height: 40,
        }
      : undefined)
    renderFacade()

    fireEvent.click(screen.getByRole('button', { name: 'Select and focus node' }))
    assert.equal(output('Selected node'), 'first')
    assert.equal(reactFlow.setCenter.mock.calls.length, 0)

    animationFrame?.(0)
    assert.deepEqual(reactFlow.setCenter.mock.calls[0], [
      60,
      40,
      { zoom: 1.5, duration: 300 },
    ])

    reactFlow.setCenter.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Focus node' }))
    assert.equal(reactFlow.setCenter.mock.calls.length, 1)

    fireEvent.click(screen.getByRole('button', { name: 'Focus missing node' }))
    assert.equal(reactFlow.setCenter.mock.calls.length, 1)

    fireEvent.click(screen.getByRole('button', { name: 'Fit view' }))
    assert.deepEqual(reactFlow.fitView.mock.calls[0], [{ padding: 0.25 }])

  })
})
