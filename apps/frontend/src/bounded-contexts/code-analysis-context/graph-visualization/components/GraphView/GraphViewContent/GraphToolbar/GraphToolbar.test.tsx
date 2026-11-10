// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { ReactFlowProvider } from 'reactflow'
import { createVsCodeEvent } from '@flowlens/registries/vscode-events'
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { GraphProvider } from '#code-analysis-context/graph-visualization/context/index.ts'
import type { ExplainNodeRequest } from '#code-analysis-context/code-insights/apis/useExplainNodeQuery/requestNodeExplanation.ts'
import translations from '../../../../../../../../public/locales/en/code-analysis-context.json'
import { NodeDetailsInspector } from '../NodeDetailsInspector/NodeDetailsInspector'
import { GraphToolbar } from './GraphToolbar'

vi.mock('#common/hooks/useTranslation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], translations),
  }),
}))

afterEach(cleanup)

const explanation = { purpose: 'Test explanation', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] }

function setup(runtimeHost: 'vscode' | 'web-app' | 'cli' = 'vscode') {
  const sent: ExplainNodeRequest[] = []
  const vscodeApi = { postMessage: (message: unknown) => { sent.push(message as ExplainNodeRequest) } }
  const view = (nodeId: string | undefined, graphId: string) => (
    <AppShell config={{ runtimeHost, vscodeApi }}>
      <ReactFlowProvider>
        <GraphProvider graphId={graphId} graph={{ nodes: [], edges: [] }}>
          <GraphToolbar onFitView={() => {}} />
          {nodeId && <NodeDetailsInspector node={createFunctionDeclarationNode({ id: nodeId })} />}
        </GraphProvider>
      </ReactFlowProvider>
    </AppShell>
  )
  const result = render(view('one', 'graph'))

  return { sent, ...result, change: (nodeId: string | undefined, graphId = 'graph') => result.rerender(view(nodeId, graphId)) }
}

function succeed(request: ExplainNodeRequest) {
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: createVsCodeEvent('explain.node.result', { ...request.payload, explanation }),
  })))
}

describe('GraphToolbar', () => {
  it('sends the selected backend only on Explain and preserves the existing message fields', async () => {
    const { sent } = setup()
    const select = screen.getByRole('combobox', { name: 'AI backend' }) as HTMLSelectElement
    assert.equal(select.value, 'openai-api')
    const toolbar = screen.getByRole('button', { name: 'Fit' }).closest('header')
    assert.ok(toolbar)
    assert.equal(within(toolbar).getByRole('combobox', { name: 'AI backend' }), select)
    assert.equal(within(screen.getByRole('complementary')).queryByRole('combobox'), null)
    assert.deepEqual(Array.from(select.options, option => [option.text, option.value]), [
      ['OpenAI API', 'openai-api'], ['Claude API', 'claude-api'], ['Codex CLI', 'codex-cli'],
    ])

    for (const backend of ['openai-api', 'claude-api', 'codex-cli']) {
      const previousRequestCount = sent.length
      fireEvent.change(select, { target: { value: backend } })
      assert.equal(select.value, backend)
      assert.equal(sent.length, previousRequestCount)
      fireEvent.click(screen.getByRole('button', { name: previousRequestCount ? 'Explain again' : 'Explain' }))
      assert.equal(sent.length, previousRequestCount + 1)
      const request = sent.at(-1)!
      assert.equal(typeof request.payload.requestId, 'string')
      assert.ok(request.payload.requestId.length > 0)
      assert.deepEqual(request, {
        type: 'explain.node',
        payload: { graphId: 'graph', nodeId: 'one', requestId: request.payload.requestId, backend },
      })
      succeed(request)
      await screen.findByRole('button', { name: 'Explain again' })
    }
  })

  it('preserves the backend across nodes, inspector remounts and graph changes', () => {
    const { sent, change } = setup()
    fireEvent.change(screen.getByRole('combobox', { name: 'AI backend' }), { target: { value: 'codex-cli' } })
    change('two')
    assert.equal((screen.getByRole('combobox', { name: 'AI backend' }) as HTMLSelectElement).value, 'codex-cli')
    change(undefined)
    assert.equal(screen.queryByRole('complementary'), null)
    assert.equal((screen.getByRole('combobox', { name: 'AI backend' }) as HTMLSelectElement).value, 'codex-cli')
    change('three', 'next-graph')
    assert.equal((screen.getByRole('combobox', { name: 'AI backend' }) as HTMLSelectElement).value, 'codex-cli')
    assert.equal(sent.length, 0)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.payload.backend, 'codex-cli')
    assert.equal(sent[0]!.payload.nodeId, 'three')
    assert.equal(sent[0]!.payload.graphId, 'next-graph')
  })

  it('uses a backend selected during a pending request on the next explicit click', async () => {
    const { sent } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'AI backend' }), { target: { value: 'claude-api' } })
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.payload.backend, 'openai-api')
    succeed(sent[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Explain again' }))
    assert.equal(sent.length, 2)
    assert.equal(sent[1]!.payload.backend, 'claude-api')
    succeed(sent[1]!)
    await screen.findByRole('button', { name: 'Explain again' })
  })

  for (const runtime of ['web-app', 'cli'] as const) {
    it(`omits the AI backend selector in ${runtime}`, () => {
      const { sent } = setup(runtime)
      assert.equal(screen.queryByRole('combobox', { name: 'AI backend' }), null)
      assert.ok(screen.getByRole('combobox', { name: 'Direction' }))
      assert.equal((screen.getByRole('button', { name: 'Explain' }) as HTMLButtonElement).disabled, true)
      assert.equal(sent.length, 0)
    })
  }
})
