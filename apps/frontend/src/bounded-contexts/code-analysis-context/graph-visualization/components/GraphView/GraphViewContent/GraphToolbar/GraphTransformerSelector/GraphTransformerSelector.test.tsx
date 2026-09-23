// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import { createCallExpressionNode, createNode } from '@flowlens/analyzer-core/fixtures/node'
import { AppShell } from '@common/test-utils/appShell'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import {
  type GraphTransformerId,
  transformGraph,
} from '@code-analysis-context/graph-visualization/domain/transformer'
import { GraphProvider } from '@code-analysis-context/graph-visualization/context'
import { GraphTransformerSelector } from './GraphTransformerSelector'

vi.mock('@common/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

const graph: FlowGraph = {
  nodes: [
    createNode({ id: 'caller', sourceOrigin: 'project' }),
    createCallExpressionNode({ id: 'call', sourceOrigin: 'project' }),
    createNode({ id: 'callee', sourceOrigin: 'external' }),
  ],
  edges: [
    createEdge({ id: 'calls', source: 'caller', target: 'call', type: 'calls' }),
    createEdge({ id: 'references', source: 'call', target: 'callee', type: 'references' }),
  ],
}

function TransformedGraph() {
  const transformedGraph = graphFacade.data.useTransformedGraph()

  return <output aria-label="Transformed graph">{JSON.stringify(transformedGraph)}</output>
}

describe('GraphTransformerSelector', () => {
  it('updates the selected radio and transformed graph and preserves selection across remounts', () => {
    const assertSelection = (transformer: GraphTransformerId) => {
      for (const radio of screen.getAllByRole<HTMLInputElement>('radio')) {
        assert.equal(radio.checked, radio.value === transformer)
      }
      assert.deepEqual(
        JSON.parse(screen.getByRole('status').textContent ?? ''),
        transformGraph(graph, transformer),
      )
    }
    const consumers = (
      <AppShell>
        <GraphProvider graph={graph}>
          <GraphTransformerSelector />
          <TransformedGraph />
        </GraphProvider>
      </AppShell>
    )
    const view = render(consumers)

    assertSelection('projectSource')
    for (const transformer of ['none', 'flow', 'projectSource', 'none'] as const) {
      fireEvent.click(screen.getByRole('radio', {
        name: `graphVisualization.transformers.options.${transformer}`,
      }))
      assertSelection(transformer)
    }

    view.rerender(<AppShell />)
    view.rerender(consumers)
    assertSelection('none')
  })
})
