// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { createVsCodeEvent, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { VSCODE_REQUEST_TIMEOUT_MS } from '#common/config/index.ts'
import { fetchAiConfiguration, saveAiConfiguration } from './requestAiSettings'

const configuration = { backend: 'openai-api', credentialPresence: { openai: true, anthropic: false } } as const
const reply = (message: unknown) => window.dispatchEvent(new MessageEvent('message', { data: message }))

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('fetchAiConfiguration', () => {
  it('accepts correlated flags only, rejects malformed or secret-bearing replies, and cleans up', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const result = await fetchAiConfiguration({ postMessage(message) {
      const { payload: { requestId } } = message as VsCodeEventRegistry['ai.settings.get']
      const response = createVsCodeEvent('ai.settings.result', { requestId, configuration })
      reply({ type: 'ai.settings.result' })
      reply({ ...response, payload: { ...response.payload, requestId: 'unrelated' } })
      reply({ ...response, payload: { requestId, configuration: { ...configuration, apiKey: 'must-not-return' } } })
      assert.equal(remove.mock.calls.length, 0)
      reply(response)
    } })
    assert.deepEqual(result, configuration)
    assert.equal(remove.mock.calls.length, 1)
  })

  it('times out an older host, cleans up, and supports abort without sending pre-aborted requests', async () => {
    vi.useFakeTimers()
    const postMessage = vi.fn()
    const remove = vi.spyOn(window, 'removeEventListener')
    const timeout = assert.rejects(fetchAiConfiguration({ postMessage }), { reason: 'timed-out', operation: 'ai.settings.get' })
    await vi.advanceTimersByTimeAsync(VSCODE_REQUEST_TIMEOUT_MS)
    await timeout
    assert.equal(remove.mock.calls.length, 1)
    assert.equal(vi.getTimerCount(), 0)
    const controller = new AbortController()
    const abort = assert.rejects(fetchAiConfiguration({ postMessage }, controller.signal), { reason: 'cancelled' })
    controller.abort()
    await abort
    await assert.rejects(fetchAiConfiguration({ postMessage }, controller.signal), { reason: 'cancelled' })
    assert.equal(postMessage.mock.calls.length, 2)
    assert.equal(vi.getTimerCount(), 0)
  })
})

describe('saveAiConfiguration', () => {
  it('awaits onSuccess with the confirmed configuration and preserves the return value', async () => {
    const onFailure = vi.fn()
    const notifications: unknown[] = []
    const onSuccess = vi.fn(async (saved) => {
      await Promise.resolve()
      notifications.push(saved)
    })
    const saved = await saveAiConfiguration({ postMessage(message) {
      const request = message as VsCodeEventRegistry['ai.settings.save']
      reply(createVsCodeEvent('ai.settings.result', { requestId: request.payload.requestId, configuration }))
    } }, { backend: 'openai-api' }, { onSuccess, onFailure })

    assert.deepEqual(saved, configuration)
    assert.deepEqual(notifications, [configuration])
    assert.equal(onSuccess.mock.calls.length, 1)
    assert.equal(onFailure.mock.calls.length, 0)
  })

  it('awaits onFailure and still rejects with the original failure, including cancellation', async () => {
    const onSuccess = vi.fn()
    const failures: unknown[] = []
    const onFailure = vi.fn(async (error: unknown) => {
      await Promise.resolve()
      failures.push(error)
    })
    const api = { postMessage(message: unknown) {
      const request = message as VsCodeEventRegistry['ai.settings.save']
      reply(createVsCodeEvent('ai.settings.error', { requestId: request.payload.requestId, reason: 'save-failed' }))
    } }
    const assertOriginalFailure = (error: unknown) => {
      assert.equal(error, failures.at(-1))
      return true
    }
    await assert.rejects(saveAiConfiguration(api, { backend: 'openai-api' }, { onSuccess, onFailure }), assertOriginalFailure)
    await assert.rejects(saveAiConfiguration(api, { backend: 'openai-api' }, {
      signal: AbortSignal.abort(), onSuccess, onFailure,
    }), assertOriginalFailure)
    assert.equal(onFailure.mock.calls.length, 2)
    assert.equal(onSuccess.mock.calls.length, 0)
  })

  it('propagates success callback errors without reporting a failed save', async () => {
    const cause = new Error('Success callback failed')
    const onFailure = vi.fn()
    await assert.rejects(saveAiConfiguration({ postMessage(message) {
      const request = message as VsCodeEventRegistry['ai.settings.save']
      reply(createVsCodeEvent('ai.settings.result', { requestId: request.payload.requestId, configuration }))
    } }, { backend: 'openai-api' }, { onSuccess: () => { throw cause }, onFailure }), error => error === cause)
    assert.equal(onFailure.mock.calls.length, 0)
  })

  it('submits the provider-tagged credential only to the host and returns confirmed flags', async () => {
    const change = { backend: 'openai-api', credential: { provider: 'openai', apiKey: 'new-key' } } as const
    const saved = await saveAiConfiguration({ postMessage(message) {
      const request = message as VsCodeEventRegistry['ai.settings.save']
      assert.equal(request.type, 'ai.settings.save')
      assert.deepEqual(request.payload.configuration, change)
      reply(createVsCodeEvent('ai.settings.result', { requestId: request.payload.requestId, configuration }))
    } }, change)
    assert.deepEqual(saved, configuration)
    assert.equal(JSON.stringify(saved).includes('new-key'), false)
  })

  it('normalizes host failures and delivery errors without retaining secrets', async () => {
    const change = { backend: 'openai-api', credential: { provider: 'openai', apiKey: 'private-key' } } as const
    await assert.rejects(saveAiConfiguration({ postMessage(message) {
      const request = message as VsCodeEventRegistry['ai.settings.save']
      reply(createVsCodeEvent('ai.settings.error', { requestId: request.payload.requestId, reason: 'save-failed' }))
    } }, change), { reason: 'save-failed' })
    await assert.rejects(saveAiConfiguration({ postMessage() { throw new Error('private-key') } }, change), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal(error.cause, undefined)
      assert.equal(JSON.stringify(error).includes('private-key'), false)
      assert.match(error.message, /delivery-failed/)
      return true
    })
  })

  it('requires confirmation and stops listening after a save timeout', async () => {
    vi.useFakeTimers()
    const remove = vi.spyOn(window, 'removeEventListener')
    const pending = assert.rejects(saveAiConfiguration({ postMessage() {} }, { backend: 'codex-cli' }), { reason: 'timed-out' })
    await vi.advanceTimersByTimeAsync(VSCODE_REQUEST_TIMEOUT_MS)
    await pending
    assert.equal(remove.mock.calls.length, 1)
    assert.equal(vi.getTimerCount(), 0)
  })
})
