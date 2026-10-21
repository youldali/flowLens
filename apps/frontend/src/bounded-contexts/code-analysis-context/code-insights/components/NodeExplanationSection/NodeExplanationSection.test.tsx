// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { useQueryClient } from 'react-query'
import type { PropsWithChildren } from 'react'
import { createVsCodeEvent, type ExplainNodeEvent, type ExplainNodeErrorEvent } from '@flowlens/registries/vscode-events'
import { GraphProvider } from '#code-analysis-context/graph-visualization/context/index.ts'
import { AppShell } from '#common/test-utils/appShell.tsx'
import translations from '../../../../../../public/locales/en/code-analysis-context.json'
import { NodeExplanationSection } from './NodeExplanationSection'

vi.mock('#common/hooks/useTranslation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], translations),
  }),
}))

afterEach(cleanup)

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
  const vscodeApi = { postMessage(message: unknown) {
    if (deliveryFails) throw new Error('Delivery failed')
    sent.push(message as ExplainNodeEvent)
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
  return { sent, ...result, change: (nodeId: string, graphId = 'graph') => result.rerender(view(nodeId, graphId)) }
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
    succeed(sent[0]!)
    await screen.findByText(explanation.purpose)
    for (const item of [explanation.behavior, explanation.sideEffects, explanation.failureCases, explanation.uncertainties].flat()) {
      screen.getByText(item)
    }
    assert.equal(container.querySelector('script'), null)
    change('two')
    assert.equal(screen.queryByText(explanation.purpose), null)
    change('one')
    await screen.findByText(explanation.purpose)
    assert.equal(sent.length, 1)
    fireEvent.click(screen.getByRole('button', { name: 'Explain again' }))
    screen.getByText(explanation.purpose)
    fail(sent[1]!, 'api-error')
    await screen.findByRole('alert')
    screen.getByText(explanation.purpose)
  })

  it('dismisses errors, clears them on retry, and omits empty result lists', async () => {
    const { sent } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[0]!, 'missing-api-token')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    assert.equal(screen.queryByRole('alert'), null)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    fail(sent[1]!, 'invalid-output')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    await waitFor(() => assert.equal(screen.queryByRole('alert'), null))
    succeed(sent[2]!, { purpose: 'Only purpose', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] })
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
      const alert = await screen.findByRole('alert')
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
    assert.equal(screen.queryByRole('alert'), null)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    change('two', 'next-graph')
    succeed(sent[1]!)
    assert.equal(screen.queryByText(explanation.purpose), null)
    assert.equal(screen.queryByRole('alert'), null)
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))
    assert.equal(sent[2]!.payload.graphId, 'next-graph')
    succeed(sent[2]!)
    await screen.findByText(explanation.purpose)
  })
})
