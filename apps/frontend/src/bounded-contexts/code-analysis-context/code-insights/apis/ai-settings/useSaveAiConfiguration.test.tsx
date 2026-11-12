// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { useQueryClient } from 'react-query'
import { createVsCodeEvent, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { AppShell } from '#common/test-utils/appShell.tsx'
import type * as AiConfigDomain from '@flowlens/registries/vscode-events'
import { aiConfigurationQueryKey, useFetchAiConfiguration } from './useFetchAiConfiguration'
import { useSaveAiConfiguration } from './useSaveAiConfiguration'

const initial: AiConfigDomain.AiConfiguration = { backend: 'openai-api', credentialPresence: { openai: true, anthropic: false } }
const confirmed: AiConfigDomain.AiConfiguration = { backend: 'claude-api', credentialPresence: { openai: true, anthropic: true } }
const change: AiConfigDomain.AiConfigurationChange = { backend: 'claude-api', credential: { provider: 'anthropic', apiKey: 'private-test-key' } }

afterEach(cleanup)

function setup() {
  const sent: VsCodeEventRegistry['ai.settings.get' | 'ai.settings.save'][] = []
  const vscodeApi = { postMessage: (message: unknown) => { sent.push(message as typeof sent[number]) } }
  const hook = renderHook(() => ({
    mutation: useSaveAiConfiguration(),
    query: useFetchAiConfiguration({ enabled: false }),
    client: useQueryClient(),
  }), {
    wrapper: ({ children }) => <AppShell config={{ runtimeHost: 'vscode', vscodeApi }}>{children}</AppShell>,
  })
  act(() => hook.result.current.client.setQueryData(aiConfigurationQueryKey, initial))
  return { ...hook, sent }
}

function reply(message: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data: message }))
}

function assertNoCachedSecrets(client: ReturnType<typeof useQueryClient>) {
  const states = [
    ...client.getQueryCache().getAll().map(query => query.state),
    ...client.getMutationCache().getAll().map(mutation => mutation.state),
  ]
  assert.equal(JSON.stringify(states).includes('private-test-key'), false)
  assert.ok(client.getMutationCache().getAll().every(mutation => mutation.state.variables === undefined))
}

describe('useSaveAiConfiguration', () => {
  it('shares pending saves, publishes only confirmed data and prevents a late load from overwriting it', async () => {
    const { result, sent } = setup()
    let loading!: ReturnType<typeof result.current.query.refetch>
    let saving!: Promise<AiConfigDomain.AiConfiguration>

    act(() => { loading = result.current.query.refetch() })
    await waitFor(() => assert.equal(sent.length, 1))
    act(() => {
      saving = result.current.mutation.mutateAsync({ configuration: change })
      result.current.mutation.mutate({ configuration: change })
      assert.equal(result.current.mutation.mutateAsync({ configuration: change }), saving)
    })
    await waitFor(() => assert.equal(sent.length, 2))
    assert.equal(result.current.mutation.isLoading, true)
    assert.deepEqual(result.current.query.data, initial)
    assertNoCachedSecrets(result.current.client)

    await act(async () => {
      reply(createVsCodeEvent('ai.settings.result', { requestId: sent[1]!.payload.requestId, configuration: confirmed }))
      assert.deepEqual(await saving, confirmed)
      await loading
      reply(createVsCodeEvent('ai.settings.result', { requestId: sent[0]!.payload.requestId, configuration: initial }))
    })
    await waitFor(() => assert.deepEqual(result.current.query.data, confirmed))
    assert.equal(result.current.mutation.isLoading, false)
    assertNoCachedSecrets(result.current.client)
  })

  it('keeps cached configuration on failure and exposes mutation errors until retry succeeds', async () => {
    const { result, sent } = setup()
    let failed!: Promise<void>
    act(() => { failed = assert.rejects(result.current.mutation.mutateAsync({ configuration: change }), { reason: 'save-failed' }) })
    await waitFor(() => assert.equal(sent.length, 1))
    await act(async () => {
      reply(createVsCodeEvent('ai.settings.error', { requestId: sent[0]!.payload.requestId, reason: 'save-failed' }))
      await failed
    })
    assert.equal(result.current.mutation.error?.reason, 'save-failed')
    assert.deepEqual(result.current.query.data, initial)
    assertNoCachedSecrets(result.current.client)

    let saving!: Promise<AiConfigDomain.AiConfiguration>
    act(() => { saving = result.current.mutation.mutateAsync({ configuration: change }) })
    await waitFor(() => assert.equal(sent.length, 2))
    assert.equal(result.current.mutation.error, null)
    await act(async () => {
      reply(createVsCodeEvent('ai.settings.result', { requestId: sent[1]!.payload.requestId, configuration: confirmed }))
      await saving
    })
    assert.deepEqual(result.current.query.data, confirmed)
    assertNoCachedSecrets(result.current.client)
  })

  it('keeps cached configuration when a save is aborted and ignores its late confirmation', async () => {
    const { result, sent } = setup()
    const controller = new AbortController()
    let cancelled!: Promise<void>
    act(() => {
      cancelled = assert.rejects(result.current.mutation.mutateAsync({ configuration: change, signal: controller.signal }), { reason: 'cancelled' })
    })
    await waitFor(() => assert.equal(sent.length, 1))
    await act(async () => {
      controller.abort()
      await cancelled
      reply(createVsCodeEvent('ai.settings.result', { requestId: sent[0]!.payload.requestId, configuration: confirmed }))
    })
    assert.deepEqual(result.current.query.data, initial)
    assert.equal(result.current.mutation.error?.reason, 'cancelled')
    assertNoCachedSecrets(result.current.client)
  })

  it('preserves mutation state, reset and per-call callbacks through both entrypoints', async () => {
    const { result, sent } = setup()
    const variables = { configuration: change }
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const onSettled = vi.fn()
    const options = { onSuccess, onError, onSettled }
    let saving!: Promise<AiConfigDomain.AiConfiguration>

    await waitFor(() => assert.equal(result.current.mutation.isIdle, true))
    act(() => { saving = result.current.mutation.mutateAsync(variables, options) })
    await waitFor(() => assert.equal(sent.length, 1))
    await act(async () => {
      reply(createVsCodeEvent('ai.settings.result', { requestId: sent[0]!.payload.requestId, configuration: confirmed }))
      await saving
    })
    await waitFor(() => assert.equal(result.current.mutation.isSuccess, true))
    await waitFor(() => assert.deepEqual(result.current.mutation.data, confirmed))
    assert.deepEqual(onSuccess.mock.calls, [[confirmed, variables, undefined]])
    assert.deepEqual(onSettled.mock.calls, [[confirmed, null, variables, undefined]])

    act(() => result.current.mutation.reset())
    await waitFor(() => assert.equal(result.current.mutation.isIdle, true))
    await waitFor(() => assert.equal(result.current.mutation.data, undefined))
    act(() => assert.equal(result.current.mutation.mutate(variables, options), undefined))
    await waitFor(() => assert.equal(sent.length, 2))
    await act(async () => {
      reply(createVsCodeEvent('ai.settings.error', { requestId: sent[1]!.payload.requestId, reason: 'save-failed' }))
    })
    await waitFor(() => assert.equal(result.current.mutation.isError, true))
    assert.deepEqual(onError.mock.calls, [[result.current.mutation.error, variables, undefined]])
    assert.deepEqual(onSettled.mock.calls[1], [undefined, result.current.mutation.error, variables, undefined])
    assert.equal(onSuccess.mock.calls.length, 1)
    assertNoCachedSecrets(result.current.client)
  })
})
