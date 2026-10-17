// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import type { PropsWithChildren } from 'react'
import { GraphProvider } from '@code-analysis-context/graph-visualization/context'
import { AppShell } from '@common/test-utils/appShell'
import { createVsCodeEvent, type ExplainNodeEvent } from '@flowlens/registries/vscode-events'
import { useExplainNodeQuery } from './useExplainNodeQuery'

const explanation = { purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] }
afterEach(cleanup)

function setup(postMessage?: (message: ExplainNodeEvent) => void) {
  let graphId = 'graph'
  const sent: ExplainNodeEvent[] = []
  const vscodeApi = { postMessage: (message: unknown) => {
    sent.push(message as ExplainNodeEvent)
    postMessage?.(message as ExplainNodeEvent)
  } }
  const wrapper = ({ children }: PropsWithChildren) => <AppShell config={{ runtimeHost: 'vscode', vscodeApi }}><GraphProvider graphId={graphId} graph={{ nodes: [], edges: [] }}>{children}</GraphProvider></AppShell>
  const hook = renderHook(() => ({
    query: useExplainNodeQuery('one'),
    secondQuery: useExplainNodeQuery('two'),
  }), { wrapper })

  return { sent, ...hook, changeGraph: (nextGraphId: string) => {
    graphId = nextGraphId
    hook.rerender()
  } }
}

function reply(request: ExplainNodeEvent) {
  act(() => { window.dispatchEvent(new MessageEvent('message', {
    data: createVsCodeEvent('explain.node.result', { ...request.payload, explanation }),
  })) })
}

describe('useExplainNodeQuery', () => {
  it('sends only on demand, shares pending queries, and explicitly refreshes completed queries', async () => {
    const { result, sent } = setup()

    assert.equal(sent.length, 0)
    assert.equal(result.current.query.status, 'idle')
    const first = result.current.query.refetch()
    const duplicate = result.current.query.refetch()
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.payload.graphId, 'graph')
    await waitFor(() => assert.equal(result.current.query.isLoading, true))
    reply(sent[0]!)
    assert.deepEqual((await first).data, explanation)
    assert.deepEqual((await duplicate).data, explanation)
    await waitFor(() => assert.deepEqual(result.current.query.data, explanation))
    assert.equal(sent.length, 1)
    const refreshed = result.current.query.refetch()
    assert.equal(sent.length, 2)
    assert.notEqual(sent[0]!.payload.requestId, sent[1]!.payload.requestId)
    reply(sent[1]!)
    await refreshed
  })

  it('handles independent concurrent nodes in response arrival order', async () => {
    const { result, sent } = setup()
    const first = result.current.query.refetch()
    const second = result.current.secondQuery.refetch()

    reply(sent[1]!)
    assert.deepEqual((await second).data, explanation)
    assert.equal(result.current.query.data, undefined)
    reply(sent[0]!)
    assert.deepEqual((await first).data, explanation)
  })

  it('cancels pending queries on graph changes and unmount', async () => {
    const { result, sent, changeGraph, unmount } = setup()
    const first = result.current.query.refetch()

    changeGraph('new')
    await first
    reply(sent[0]!)
    assert.equal(result.current.query.data, undefined)
    const next = result.current.query.refetch()
    assert.equal(sent[1]!.payload.graphId, 'new')
    unmount()
    await next
  })

  it('exposes remote errors through the query without retrying', async () => {
    const { result, sent } = setup()
    const pending = result.current.query.refetch()

    act(() => window.dispatchEvent(new MessageEvent('message', {
      data: createVsCodeEvent('explain.node.error', { ...sent[0]!.payload, reason: 'stale-graph' }),
    })))
    assert.equal((await pending).error?.reason, 'stale-graph')
    await waitFor(() => assert.equal(result.current.query.error?.reason, 'stale-graph'))
    assert.equal(sent.length, 1)
  })
})
