// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { createVsCodeEvent, type ExplainNodeEvent } from '@flowlens/registries/vscode-events'
import { requestNodeExplanationViaVsCode } from './requestNodeExplanation'

const explanation = { purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] }
afterEach(() => vi.restoreAllMocks())

function send(data: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data }))
}

describe('requestNodeExplanationViaVsCode', () => {
  it('filters malformed and mismatched responses, handles synchronous replies, and removes its listener', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const api = { postMessage: (message: unknown) => {
      const { payload } = message as ExplainNodeEvent

      send({ type: 'explain.node.result', payload: { ...payload, explanation: {} } })
      send(createVsCodeEvent('explain.node.result', { ...payload, requestId: 'wrong', explanation }))
      send(createVsCodeEvent('explain.node.result', { ...payload, graphId: 'wrong', explanation }))
      send(createVsCodeEvent('explain.node.result', { ...payload, nodeId: 'wrong', explanation }))
      assert.equal(remove.mock.calls.length, 0)
      send(createVsCodeEvent('explain.node.result', { ...payload, explanation }))
    } }

    assert.deepEqual(await requestNodeExplanationViaVsCode(api, 'graph', 'one'), explanation)
    assert.equal(remove.mock.calls[0]?.[0], 'message')
  })

  it('removes listeners on remote errors and delivery failures', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const cause = new Error('Unavailable')

    await assert.rejects(requestNodeExplanationViaVsCode({ postMessage: () => { throw cause } }, 'graph', 'one'), { reason: 'delivery-failed', cause, originalError: cause, transport: 'vscode', operation: 'explain.node' })
    await assert.rejects(requestNodeExplanationViaVsCode({ postMessage: (message: unknown) => {
      send(createVsCodeEvent('explain.node.error', { ...(message as ExplainNodeEvent).payload, reason: 'stale-graph' }))
    } }, 'graph', 'one'), { reason: 'stale-graph', transport: 'vscode', operation: 'explain.node' })
    assert.equal(remove.mock.calls.length, 2)
  })

  it('removes listeners when cancelled and does not send already cancelled requests', async () => {
    const controller = new AbortController()
    const postMessage = vi.fn()
    const remove = vi.spyOn(window, 'removeEventListener')
    const pending = requestNodeExplanationViaVsCode({ postMessage }, 'graph', 'one', controller.signal)
    const rejection = assert.rejects(pending, { reason: 'cancelled' })

    controller.abort()
    await rejection
    assert.equal(remove.mock.calls[0]?.[0], 'message')
    await assert.rejects(requestNodeExplanationViaVsCode({ postMessage }, 'graph', 'one', controller.signal), { reason: 'cancelled' })
    assert.equal(postMessage.mock.calls.length, 1)
  })
})
