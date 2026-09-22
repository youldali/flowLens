import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, vi } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node'
import { AppShell } from '@common/test-utils/appShell'
import { GraphView } from './GraphView'

const { graph } = vi.hoisted(() => ({
  graph: { nodes: [], edges: [] } as FlowGraph,
}))

vi.mock('@common/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@common/hooks/useVsCodeApi', () => ({
  useVsCodeApi: () => ({ postMessage: vi.fn() }),
}))
vi.mock('@code-analysis-context/graph-visualization/apis/fetchGraph', () => ({
  useFetchGraph: () => ({ status: 'success', data: graph }),
}))
vi.mock('./FromVsCode/useGraph', () => ({ useGraph: () => graph }))

describe('GraphView', () => {
  for (const runtimeHost of ['web-app', 'cli', 'vscode'] as const) {
    it(`renders the shared toolbar and canvas in ${runtimeHost}`, () => {
      const name = 'aVeryLongFocusedFunctionName'.repeat(20)
      graph.nodes = [createFunctionDeclarationNode({ name })]
      const markup = renderToStaticMarkup(
        <AppShell config={{ runtimeHost }}>
          <GraphView />
        </AppShell>,
      )

      assert.equal((markup.match(/type="radio"/g) ?? []).length, 3)
      for (const value of ['none', 'flow', 'projectSource']) {
        assert.ok(markup.includes(`value="${value}"`))
      }
      assert.ok(markup.includes('graphVisualization.fit'))
      assert.ok(markup.includes(`title="${name}"`))
      assert.ok(markup.includes('react-flow'))
      assert.ok(!markup.includes('<fieldset'))
      assert.ok(!markup.includes('<h1'))
    })
  }
})
