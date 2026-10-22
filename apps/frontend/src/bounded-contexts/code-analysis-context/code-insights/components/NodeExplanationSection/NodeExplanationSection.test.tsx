// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { useQueryClient } from 'react-query'
import type { PropsWithChildren } from 'react'
import { createVsCodeEvent, type ExplainNodeEvent, type ExplainNodeErrorEvent, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { GraphProvider } from '#code-analysis-context/graph-visualization/context/index.ts'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { VsCodeQueryErrorClass } from '#common/utils/QueryError/index.ts'
import * as explanationRequest from '../../apis/useExplainNodeQuery/requestNodeExplanation'
import translations from '../../../../../../public/locales/en/code-analysis-context.json'
import { NodeExplanationSection } from './NodeExplanationSection'

vi.mock('#common/hooks/useTranslation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], translations),
  }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const explanation = {
  purpose: '<script>Plain text purpose</script>',
  behavior: ['Reads input'],
  sideEffects: ['Writes output'],
  failureCases: ['Throws on invalid input'],
  uncertainties: ['External behavior is unknown'],
}

function KeepCache({ children }: PropsWithChildren) {
  const client = useQueryClient()
  client.setQueryDefaults(['graph'], { cacheTime: Infinity })
  return children
}

function setup(runtimeHost: 'vscode' | 'web-app' | 'cli' = 'vscode', deliveryFails = false) {
  const sent: ExplainNodeEvent[] = []
  const recovery: VsCodeEventRegistry['ai.configure'][] = []
  const graphRequests: unknown[] = []
  const vscodeApi = { postMessage(message: unknown) {
    if (deliveryFails) throw new Error('Delivery failed')
    if ((message as { type: string }).type === 'ai.configure') {
      recovery.push(message as VsCodeEventRegistry['ai.configure'])
    } else if ((message as { type: string }).type === 'graph.generate') {
      graphRequests.push(message)
    } else {
      sent.push(message as ExplainNodeEvent)
    }
  } }
  const view = (nodeId: string, graphId: string) => (
    <AppShell config={{ runtimeHost, vscodeApi }}>
      <KeepCache>
        <GraphProvider graphId={graphId} graph={{ nodes: [], edges: [] }}>
          <NodeExplanationSection nodeId={nodeId} />
        </GraphProvider>
      </KeepCache>
    </AppShell>
  )
  const result = render(view('one', 'graph'))
  return { sent, recovery, graphRequests, vscodeApi, ...result, change: (nodeId: string, graphId = 'graph') => result.rerender(view(nodeId, graphId)) }
}

function succeed(request: ExplainNodeEvent, result = explanation) {
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: createVsCodeEvent('explain.node.result', { ...request.payload, explanation: result }),
  })))
}

function fail(request: ExplainNodeEvent, reason: ExplainNodeErrorEvent['payload']['reason']) {
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: createVsCodeEvent('explain.node.error', { ...request.payload, reason }),
  })))
}

describe('NodeExplanationSection', () => {
  it('configures without credentials and offers an explicit retry after saving', async () => {
    const { sent, recovery } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'missing-api-token')
    const configure = await screen.findByRole('button', { name: 'Configure AI provider' })
    await act(async () => { fireEvent.click(configure) })
    const pending = await screen.findByRole('button', { name: 'Configuring…' })
    assert.equal((pending as HTMLButtonElement).disabled, true)
    fireEvent.click(pending)
    assert.equal(recovery.length, 1)
    assert.deepEqual(Object.keys(recovery[0]!.payload), ['requestId'])
    act(() => window.dispatchEvent(new MessageEvent('message', {
      data: createVsCodeEvent('ai.configure.result', { ...recovery[0]!.payload, outcome: 'saved' }),
    })))
    const retry = await screen.findByRole('button', { name: 'Retry' })
    assert.equal(sent.length, 1)
    fireEvent.click(retry)
    assert.equal(sent[1]!.payload.nodeId, 'one')
    succeed(sent[1]!)
    await screen.findByText(explanation.purpose)
  })

  it('resets saved configuration when a retry fails again', async () => {
    const { sent, recovery } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'missing-api-token')
    fireEvent.click(await screen.findByRole('button', { name: 'Configure AI provider' }))
    await waitFor(() => assert.equal(recovery.length, 1))
    act(() => window.dispatchEvent(new MessageEvent('message', {
      data: createVsCodeEvent('ai.configure.result', { ...recovery[0]!.payload, outcome: 'saved' }),
    })))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await screen.findByRole('button', { name: 'Explaining…' })
    fail(sent[1]!, 'missing-api-token')
    await screen.findByRole('button', { name: 'Configure AI provider' })
    assert.equal(screen.queryByText(translations.explanation.configured), null)
    assert.equal(screen.queryByRole('button', { name: 'Retry' }), null)
  })

  for (const hasCachedExplanation of [false, true]) {
    it(`keeps normal controls after cancellation ${hasCachedExplanation ? 'with' : 'without'} cached content`, async () => {
      const { sent } = setup()

      if (hasCachedExplanation) {
        fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
        succeed(sent[0]!)
        await screen.findByRole('button', { name: 'Explain again' })
      }

      vi.spyOn(explanationRequest, 'requestNodeExplanationViaVsCode').mockRejectedValueOnce(
        new VsCodeQueryErrorClass({ reason: 'cancelled', operation: 'explain.node' }),
      )
      fireEvent.click(screen.getByRole('button', { name: hasCachedExplanation ? 'Explain again' : 'Explain' }))
      const button = await screen.findByRole('button', { name: hasCachedExplanation ? 'Explain again' : 'Explain' })
      assert.equal((button as HTMLButtonElement).disabled, false)
      assert.equal(screen.queryByRole('alert'), null)
      assert.equal(screen.queryByRole('status'), null)
      assert.equal(screen.queryByText(explanation.purpose) !== null, hasCachedExplanation)
    })
  }

  it('retains configuration guidance on cancel and permits another attempt after failure', async () => {
    const { sent, recovery } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'missing-api-token')

    for (const outcome of ['cancelled', 'failed'] as const) {
      const configure = await screen.findByRole('button', { name: 'Configure AI provider' })
      await act(async () => { fireEvent.click(configure) })
      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          data: createVsCodeEvent('ai.configure.result', { ...recovery.at(-1)!.payload, outcome }),
        }))
      })
      await screen.findByRole('button', { name: 'Configure AI provider' })
      assert.ok(screen.queryByRole('button', { name: 'Retry' }) === null)
      if (outcome === 'cancelled') {
        assert.equal(screen.queryByText(translations.explanation.configurationFailed), null)
        screen.getByText(translations.explanation.descriptions['missing-api-token'])
      }
    }

    screen.getByText(translations.explanation.configurationFailed)
  })

  it('ignores old configuration replies and retries the currently selected node', async () => {
    const { sent, recovery, change } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'missing-api-token')
    const configure = await screen.findByRole('button', { name: 'Configure AI provider' })
    await act(async () => { fireEvent.click(configure) })
    change('two')
    act(() => window.dispatchEvent(new MessageEvent('message', {
      data: createVsCodeEvent('ai.configure.result', { ...recovery[0]!.payload, outcome: 'saved' }),
    })))
    assert.ok(screen.queryByText(translations.explanation.configured) === null)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[1]!, 'api-error')
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    assert.equal(sent[2]!.payload.nodeId, 'two')
    succeed(sent[2]!)
    await screen.findByText(explanation.purpose)
  })

  it('sends graph generation and offers no deferred refresh or unsupported-node action', async () => {
    const { sent, graphRequests, change } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'graph-unavailable')
    fireEvent.click(await screen.findByRole('button', { name: 'Generate graph' }))
    await waitFor(() => assert.deepEqual(graphRequests, [createVsCodeEvent('graph.generate', {})]))

    for (const reason of ['stale-graph', 'node-not-found', 'node-not-explainable'] as const) {
      change(reason)
      fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
      fail(sent.at(-1)!, reason)
      await screen.findByText(translations.explanation.errors[reason])
      assert.ok(screen.queryByRole('button') === null)
    }

  })

  for (const { reason, action, description } of [
    { reason: 'missing-api-token', action: 'Configure AI provider', description: 'configurationFailed' },
    { reason: 'graph-unavailable', action: 'Generate graph', description: 'graphDeliveryFailed' },
  ] as const) {
    it(`shows recovery delivery failure for ${reason} and permits another attempt`, async () => {
      const { sent, recovery, graphRequests, vscodeApi } = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
      fail(sent[0]!, reason)
      vi.spyOn(vscodeApi, 'postMessage').mockImplementationOnce(() => { throw new Error('Private delivery details') })
      fireEvent.click(await screen.findByRole('button', { name: action }))
      await screen.findByText(translations.explanation[description])
      assert.equal(screen.queryByText('Private delivery details'), null)

      fireEvent.click(screen.getByRole('button', { name: action }))
      await waitFor(() => assert.equal(recovery.length + graphRequests.length, 1))
      await waitFor(() => assert.equal(screen.queryByText(translations.explanation[description]), null))
    })
  }

  for (const runtime of ['web-app', 'cli'] as const) {
    it(`disables explanations in ${runtime}`, () => {
      const { sent } = setup(runtime)
      assert.equal((screen.getByRole('button', { name: 'Explain' }) as HTMLButtonElement).disabled, true)
      screen.getByText('Explanations are available in VS Code.')
      assert.equal(sent.length, 0)
    })
  }

  it('requests only on click, prevents duplicate requests, renders plain text and reuses cached results', async () => {
    const { sent, change, container } = setup()
    assert.equal(sent.length, 0)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Explaining…' }) as HTMLButtonElement).disabled, true))
    fireEvent.click(screen.getByRole('button', { name: 'Explaining…' }))
    assert.equal(sent.length, 1)
    await waitFor(() => assert.equal(screen.getAllByRole('status').length, 1))
    succeed(sent[0]!)
    await screen.findByText(explanation.purpose)
    for (const item of [explanation.behavior, explanation.sideEffects, explanation.failureCases, explanation.uncertainties].flat()) {
      screen.getByText(item)
    }
    assert.equal(container.querySelector('script'), null)
    change('two')
    assert.ok(screen.queryByText(explanation.purpose) === null)
    change('one')
    await screen.findByText(explanation.purpose)
    assert.equal(sent.length, 1)
    fireEvent.click(screen.getByRole('button', { name: 'Explain again' }))
    screen.getByText(explanation.purpose)
    await waitFor(() => assert.equal(screen.getAllByRole('status').length, 1))
    fail(sent[1]!, 'api-error')
    await screen.findByRole('alert')
    assert.ok(screen.queryByText(explanation.purpose) === null)
    assert.ok(screen.queryByRole('button', { name: 'Explain again' }) === null)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(explanation.purpose)
    succeed(sent[2]!)
    await screen.findByRole('button', { name: 'Explain again' })
  })

  it('retries failures and omits empty result lists', async () => {
    const { sent } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'invalid-output')
    await screen.findByRole('alert')
    assert.ok(screen.queryByRole('button', { name: 'Dismiss error' }) === null)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => assert.ok(screen.queryByRole('alert') === null))
    succeed(sent[1]!, { purpose: 'Only purpose', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] })
    await screen.findByText('Only purpose')
    assert.equal(screen.queryAllByRole('list').length, 0)
  })

  for (const reason of [
    'missing-api-token', 'graph-unavailable', 'stale-graph', 'node-not-found',
    'node-not-explainable', 'api-error', 'invalid-output', 'generation-failed',
  ] as const) {
    it(`shows guidance for ${reason}`, async () => {
      const { sent } = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
      fail(sent[0]!, reason)
      const alert = await screen.findByRole(['api-error', 'invalid-output', 'generation-failed'].includes(reason) ? 'alert' : 'status')
      assert.ok(alert.textContent?.includes(translations.explanation.errors[reason]))
    })
  }

  it('shows delivery failure guidance', async () => {
    setup('vscode', true)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    assert.ok((await screen.findByRole('alert')).textContent?.includes(translations.explanation.errors['delivery-failed']))
  })

  it('isolates late results and errors across nodes and graph changes without cancellation alerts', async () => {
    const { sent, change } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    change('two')
    fail(sent[0]!, 'api-error')
    assert.ok(screen.queryByRole('alert') === null)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    change('two', 'next-graph')
    succeed(sent[1]!)
    assert.ok(screen.queryByText(explanation.purpose) === null)
    assert.ok(screen.queryByRole('alert') === null)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    assert.equal(sent[2]!.payload.graphId, 'next-graph')
    succeed(sent[2]!)
    await screen.findByText(explanation.purpose)
  })
})
