// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { createVsCodeEvent, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { requestConfigureAiProviderViaVsCode } from './requestConfigureAiProvider'

afterEach(() => vi.restoreAllMocks())

function reply(message: unknown, outcome: 'saved' | 'cancelled' | 'failed') {
  const { payload } = message as VsCodeEventRegistry['ai.configure']

  window.dispatchEvent(new MessageEvent('message', {
    data: createVsCodeEvent('ai.configure.result', { ...payload, outcome }),
  }))
}

describe('requestConfigureAiProviderViaVsCode', () => {
  it('filters malformed and unrelated replies, accepts synchronous outcomes, and cleans up listeners', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')

    for (const outcome of ['saved', 'cancelled'] as const) {
      const controller = new AbortController()
      const removeAbort = vi.spyOn(controller.signal, 'removeEventListener')
      const response = await requestConfigureAiProviderViaVsCode({ postMessage(message) {
        const removals = remove.mock.calls.length

        window.dispatchEvent(new MessageEvent('message', { data: { type: 'ai.configure.result' } }))
        reply({ payload: { requestId: 'unrelated' } }, 'failed')
        assert.equal(remove.mock.calls.length, removals)
        reply(message, outcome)
      } }, controller.signal)

      assert.equal(response, outcome)
      assert.equal(removeAbort.mock.calls[0]?.[0], 'abort')
    }

    assert.equal(remove.mock.calls.filter(([type]) => type === 'message').length, 2)
  })

  it('normalizes remote and delivery failures and cleans up', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const cause = new Error('Unavailable')

    await assert.rejects(requestConfigureAiProviderViaVsCode({ postMessage(message) { reply(message, 'failed') } }), {
      reason: 'configuration-failed', operation: 'ai.configure', transport: 'vscode',
    })
    await assert.rejects(requestConfigureAiProviderViaVsCode({ postMessage() { throw cause } }), {
      reason: 'delivery-failed', operation: 'ai.configure', transport: 'vscode', cause,
    })
    assert.equal(remove.mock.calls.length, 2)
  })

  it('cleans up on abort and does not send an already aborted request', async () => {
    const controller = new AbortController()
    const postMessage = vi.fn()
    const remove = vi.spyOn(window, 'removeEventListener')
    const pending = requestConfigureAiProviderViaVsCode({ postMessage }, controller.signal)
    const rejection = assert.rejects(pending, { reason: 'cancelled', operation: 'ai.configure' })

    controller.abort()
    await rejection
    assert.equal(remove.mock.calls[0]?.[0], 'message')
    await assert.rejects(requestConfigureAiProviderViaVsCode({ postMessage }, controller.signal), { reason: 'cancelled' })
    assert.equal(postMessage.mock.calls.length, 1)
  })
})
