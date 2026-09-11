// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { createGraphNodeDetailsView } from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import {
  NodeDetailsInspector,
  type NodeDetailsInspectorProps,
} from './NodeDetailsInspector'
import { NodeDetailsInspectorView } from './NodeDetailsInspectorView'

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

const defaultProps: NodeDetailsInspectorProps = {
  graph,
  selectedNodeId,
  onClose: () => {},
  onSelectNode: () => {},
}

vi.mock('@common/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => ({
      'graphVisualization.nodes.categories.functionDeclaration': 'FUNCTION',
      'graphVisualization.nodes.classifications.project': 'Project code',
      'graphVisualization.nodes.declarations.functionDeclaration': 'Function declaration',
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

afterEach(cleanup)

describe('NodeDetailsInspector', () => {
  it('renders available sections and omits unavailable optional sections and actions', () => {
    render(createElement(NodeDetailsInspector, defaultProps))

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
    assert.equal(screen.queryByRole('button', { name: 'Focus on node' }), null)
    assert.equal(screen.queryByText('Source'), null)
  })

  it('invokes close, source, focus, and connected-node actions', () => {
    const onClose = vi.fn()
    const onOpenSource = vi.fn()
    const onFocusNode = vi.fn()
    const onSelectNode = vi.fn()
    const detailsView = createGraphNodeDetailsView(graph, selectedNodeId)

    assert.ok(detailsView)
    render(createElement(NodeDetailsInspectorView, {
      ...detailsView,
      onClose,
      onOpenSource,
      onFocusNode,
      onSelectNode,
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Close node details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open source' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus on node' }))
    fireEvent.click(screen.getByRole('button', { name: /callee/ }))

    assert.equal(onClose.mock.calls.length, 1)
    assert.equal(onOpenSource.mock.calls.length, 1)
    assert.equal(onFocusNode.mock.calls.length, 1)
    assert.deepEqual(onSelectNode.mock.calls, [['callee']])
  })

  it('does not display dependency source locations', () => {
    render(createElement(NodeDetailsInspector, {
      ...defaultProps,
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) => node.id === selectedNodeId
          ? {
              ...node,
              sourceOrigin: 'external' as const,
              fileName: 'index.d.ts',
              filePath: '/project/node_modules/library/index.d.ts',
            }
          : node),
      },
    }))

    assert.equal(screen.queryByText('/project/node_modules/library/index.d.ts'), null)
    assert.equal(screen.queryByText('index.d.ts'), null)
  })
})
