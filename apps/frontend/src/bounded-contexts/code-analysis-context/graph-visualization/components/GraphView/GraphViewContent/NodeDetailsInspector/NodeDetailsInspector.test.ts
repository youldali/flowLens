// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import {
  createCallExpressionNode,
  createFunctionDeclarationNode,
} from '@flowlens/analyzer-core/fixtures/node'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { Node } from 'reactflow'
import { AppShell } from '@common/test-utils/appShell'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import { GraphProvider } from '@code-analysis-context/graph-visualization/context'
import { NodeDetailsInspector } from './NodeDetailsInspector'

const reactFlow = vi.hoisted(() => ({
  getNode: vi.fn(),
  getZoom: vi.fn(() => 1.5),
  setCenter: vi.fn(() => Promise.resolve()),
}))

vi.mock('reactflow', async (importOriginal) => ({
  ...await importOriginal<typeof import('reactflow')>(),
  useReactFlow: () => reactFlow,
}))

const selectedNodeId = 'process:10:1'
const graph: FlowGraph = {
  nodes: [
    createFunctionDeclarationNode({
      id: 'caller',
      name: 'caller',
      fileName: 'caller.ts',
      filePath: '/project/src/caller.ts',
    }),
    createFunctionDeclarationNode({
      id: selectedNodeId,
      name: 'process',
      fileName: 'process.ts',
      filePath: '/project/src/process.ts',
    }),
    createFunctionDeclarationNode({
      id: 'callee',
      name: 'callee',
      fileName: 'callee.ts',
      filePath: '/project/src/callee.ts',
    }),
  ],
  edges: [
    createEdge({ id: 'caller-edge', source: 'caller', target: selectedNodeId }),
    createEdge({ id: 'callee-edge', source: selectedNodeId, target: 'callee' }),
  ],
}

vi.mock('@common/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => ({
      'graphVisualization.nodes.categories.functionDeclaration': 'FUNCTION',
      'graphVisualization.nodes.categories.callExpression': 'CALL',
      'graphVisualization.nodes.classifications.project': 'Project code',
      'graphVisualization.nodes.declarations.functionDeclaration': 'Function declaration',
      'graphVisualization.nodes.declarations.callExpression': 'Call expression',
      'graphVisualization.nodes.relationships.calls': 'calls',
      'graphVisualization.nodes.details.close': 'Close node details',
      'graphVisualization.nodes.details.location': 'Location',
      'graphVisualization.nodes.details.declaration': 'Declaration',
      'graphVisualization.nodes.details.source': 'Source',
      'graphVisualization.nodes.details.connections': 'Connections',
      'graphVisualization.nodes.details.calledBy': 'Called by',
      'graphVisualization.nodes.details.calls': 'Calls',
      'graphVisualization.nodes.details.openSource': 'Open source',
      'graphVisualization.nodes.details.focusNode': 'Focus on node',
      'graphVisualization.nodes.details.accessibleLabel': `Node details for ${options?.name ?? ''}`,
    })[key] ?? key,
  }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
})

interface InspectorControlsProps {
  nodeIds: string[]
}

function InspectorControls({ nodeIds }: InspectorControlsProps) {
  const selectNode = graphFacade.actions.useSelectNode()
  const selectTransformer = graphFacade.actions.useSelectTransformer()

  return createElement(
    'div',
    null,
    createElement('button', {
      onClick: () => selectTransformer('none'),
      type: 'button',
    }, 'Use original graph'),
    ...nodeIds.map((nodeId) => createElement('button', {
      key: nodeId,
      onClick: (event) => selectNode(event, { id: nodeId } as Node),
      type: 'button',
    }, `Select ${nodeId}`)),
  )
}

function ConnectedNodeDetailsInspector() {
  const selectedNodeId = graphFacade.data.useSelectedNodeId()

  return selectedNodeId
    ? createElement(NodeDetailsInspector, { selectedNodeId })
    : null
}

function renderInspector(
  sourceGraph: FlowGraph,
  nodeId: string,
  onOpenSource?: (filePath: string, offset: number) => void,
  useOriginalGraph = false,
) {
  render(createElement(
    AppShell,
    null,
    createElement(
      GraphProvider,
      {
        graph: sourceGraph,
        ...(onOpenSource ? { onOpenSource } : {}),
      },
      createElement(InspectorControls, { nodeIds: sourceGraph.nodes.map((node) => node.id) }),
      createElement(ConnectedNodeDetailsInspector),
    ),
  ))

  assert.equal(screen.queryByRole('complementary'), null)
  if (useOriginalGraph) {
    fireEvent.click(screen.getByRole('button', { name: 'Use original graph' }))
  }
  fireEvent.click(screen.getByRole('button', { name: `Select ${nodeId}` }))
}

describe('NodeDetailsInspector', () => {
  it('renders facade-selected node details and available actions', () => {
    renderInspector(graph, selectedNodeId)

    for (const content of [
      'FUNCTION',
      'Project code',
      'Location',
      'process.ts',
      'Declaration',
      'Function declaration',
      'Connections',
      'Called by',
      'caller',
      'Calls',
      'callee',
    ]) {
      assert.ok(screen.getByText(content))
    }
    assert.ok(screen.getByRole('complementary', { name: 'Node details for process' }))
    assert.equal(screen.queryByRole('button', { name: 'Open source' }), null)
    assert.ok(screen.getByRole('button', { name: 'Focus on node' }))
    assert.equal(screen.queryByText('Source'), null)
  })

  it('uses facade actions for source, focus, connected-node selection, and close', () => {
    const onOpenSource = vi.fn()
    const callNode = createCallExpressionNode({
      id: 'call',
      name: 'invoke',
      fileName: 'process.ts',
      filePath: '/project/src/process.ts',
      start: 17,
    })
    const graphWithCall = {
      ...graph,
      nodes: [...graph.nodes, callNode],
    }
    reactFlow.getNode.mockReturnValue({
      id: 'call',
      data: {},
      position: { x: 10, y: 20 },
      width: 100,
      height: 40,
    })
    renderInspector(graphWithCall, callNode.id, onOpenSource, true)

    fireEvent.click(screen.getByRole('button', { name: 'Open source' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus on node' }))

    assert.deepEqual(onOpenSource.mock.calls, [['/project/src/process.ts', 17]])
    assert.deepEqual(reactFlow.setCenter.mock.calls[0], [
      60,
      40,
      { zoom: 1.5, duration: 300 },
    ])

    fireEvent.click(screen.getByRole('button', { name: `Select ${selectedNodeId}` }))
    fireEvent.click(screen.getByRole('button', { name: 'calleecalls' }))
    assert.ok(screen.getByRole('complementary', { name: 'Node details for callee' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close node details' }))
    assert.equal(screen.queryByRole('complementary'), null)
  })

  it('does not display dependency source locations', () => {
    const externalGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => node.id === selectedNodeId
        ? {
            ...node,
            sourceOrigin: 'external' as const,
            fileName: 'index.d.ts',
            filePath: '/project/node_modules/library/index.d.ts',
          }
        : node),
    }
    renderInspector(externalGraph, selectedNodeId, undefined, true)

    assert.equal(screen.queryByText('/project/node_modules/library/index.d.ts'), null)
    assert.equal(screen.queryByText('index.d.ts'), null)
  })
})
