// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { ReactFlowProvider } from 'reactflow'
import { createVsCodeEvent, isAiSettingsSaveEvent, type AiConfiguration, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { GraphProvider } from '#code-analysis-context/graph-visualization/context/index.ts'
import type { ExplainNodeRequest } from '#code-analysis-context/code-insights/apis/useExplainNodeQuery/requestNodeExplanation.ts'
import translations from '../../../../../../../../public/locales/en/code-analysis-context.json'
import { NodeDetailsInspector } from '../NodeDetailsInspector/NodeDetailsInspector'
import { GraphToolbar } from './GraphToolbar'

vi.mock('#common/hooks/useTranslation.ts', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) => {
      const text = key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], translations) as string
      return text.replace(/{{(\w+)}}/g, (_, name: string) => options[name] ?? '')
    },
  }),
}))

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const explanation = { purpose: 'Test explanation', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] }

function setup(runtimeHost: 'vscode' | 'web-app' | 'cli' = 'vscode') {
  const sent: ExplainNodeRequest[] = []
  let configuration: AiConfiguration = { backend: 'openai-api', credentialPresence: { openai: false, anthropic: false } }
  const vscodeApi = { postMessage: (message: unknown) => {
    const request = message as VsCodeEventRegistry['ai.settings.get' | 'ai.settings.save' | 'explain.node']
    if (request.type === 'explain.node') { sent.push(request as ExplainNodeRequest); return }
    if (isAiSettingsSaveEvent(request)) configuration = { ...configuration, backend: request.payload.configuration.backend }
    window.dispatchEvent(new MessageEvent('message', {
      data: createVsCodeEvent('ai.settings.result', { requestId: request.payload.requestId, configuration }),
    }))
  } }
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

async function saveBackend(backend: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Open AI settings' }))
  fireEvent.change(await screen.findByRole('combobox', { name: 'Backend' }), { target: { value: backend } })
  if (backend !== 'codex-cli') fireEvent.change(screen.getByLabelText(backend === 'openai-api' ? 'OpenAI API key' : 'Claude API key'), { target: { value: 'never-send-to-explain' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
  assert.equal(screen.queryByRole('dialog'), null)
}

describe('GraphToolbar', () => {
  it('replaces the dropdown with a settings button and includes only the saved backend in Explain', async () => {
    const { sent } = setup()
    const toolbar = screen.getByRole('button', { name: 'Fit' }).closest('header')!
    assert.ok(within(toolbar).getByRole('button', { name: 'Open AI settings' }))
    assert.equal(within(toolbar).queryByRole('combobox', { name: 'AI backend' }), null)
    assert.equal(within(screen.getByRole('complementary')).queryByRole('combobox'), null)

    for (const backend of ['openai-api', 'claude-api', 'codex-cli']) {
      await saveBackend(backend)
      fireEvent.click(screen.getByRole('button', { name: sent.length ? 'Explain again' : 'Explain' }))
      const request = sent.at(-1)!
      assert.ok(request.payload.requestId.length > 0)
      assert.deepEqual(request, {
        type: 'explain.node',
        payload: { graphId: 'graph', nodeId: 'one', requestId: request.payload.requestId, backend },
      })
      succeed(request)
      await screen.findByRole('button', { name: 'Explain again' })
    }
  })

  it('preserves the backend across nodes, inspector remounts and graph changes', async () => {
    const { sent, change } = setup()
    await saveBackend('codex-cli')
    change('two')
    change(undefined)
    assert.equal(screen.queryByRole('complementary'), null)
    change('three', 'next-graph')
    assert.match(screen.getByRole('button', { name: 'Open AI settings' }).textContent!, /Codex CLI/)
    assert.equal(sent.length, 0)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.payload.backend, 'codex-cli')
    assert.equal(sent[0]!.payload.nodeId, 'three')
    assert.equal(sent[0]!.payload.graphId, 'next-graph')
  })

  it('uses a backend saved during a pending request on the next explicit click', async () => {
    const { sent } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    await saveBackend('claude-api')
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
    it(`omits AI settings in ${runtime}`, () => {
      const { sent } = setup(runtime)
      assert.equal(screen.queryByRole('button', { name: 'Open AI settings' }), null)
      assert.ok(screen.getByRole('combobox', { name: 'Direction' }))
      assert.equal((screen.getByRole('button', { name: 'Explain' }) as HTMLButtonElement).disabled, true)
      assert.equal(sent.length, 0)
    })
  }
})
