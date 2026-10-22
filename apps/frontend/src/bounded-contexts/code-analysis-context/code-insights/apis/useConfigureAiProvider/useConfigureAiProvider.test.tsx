// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { createVsCodeEvent, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { useConfigureAiProvider } from './useConfigureAiProvider'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function reply(message: unknown, outcome: 'saved' | 'cancelled' | 'failed') {
  const { payload } = message as VsCodeEventRegistry['ai.configure']

  window.dispatchEvent(new MessageEvent('message', {
    data: createVsCodeEvent('ai.configure.result', { ...payload, outcome }),
  }))
}

function renderConfiguration(postMessage: (message: unknown) => void) {
  return renderHook(useConfigureAiProvider, {
    wrapper: ({ children }) => (
      <AppShell config={{ runtimeHost: 'vscode', vscodeApi: { postMessage } }}>{children}</AppShell>
    ),
  })
}

describe('useConfigureAiProvider', () => {
  it('shares pending work across both entrypoints, even after reset', async () => {
    const sent: unknown[] = []
    const { result } = renderConfiguration(message => { sent.push(message) })
    let first!: Promise<'saved' | 'cancelled'>
    let second!: Promise<'saved' | 'cancelled'>

    await waitFor(() => assert.equal(result.current.status, 'idle'))
    act(() => {
      first = result.current.mutateAsync()
      result.current.mutate()
      second = result.current.mutateAsync()
    })
    assert.equal(first, second)
    await waitFor(() => assert.equal(sent.length, 1))
    await waitFor(() => assert.equal(result.current.status, 'loading'))
    act(() => result.current.reset())
    await waitFor(() => assert.equal(result.current.status, 'idle'))
    act(() => result.current.mutate())
    assert.equal(sent.length, 1)
    await act(async () => {
      reply(sent[0], 'saved')
      assert.equal(await first, 'saved')
    })
    // Reset detaches the previous mutation; the next invocation starts fresh.
    act(() => result.current.mutate())
    await waitFor(() => assert.equal(sent.length, 2))
    await act(async () => { reply(sent[1], 'cancelled') })
    await waitFor(() => assert.equal(result.current.data, 'cancelled'))
  })

  it('reports success, cancellation and failure, with explicit retry and reset', async () => {
    let outcome: 'saved' | 'cancelled' | 'failed' = 'saved'
    const postMessage = vi.fn((message: unknown) => { reply(message, outcome) })
    const { result } = renderConfiguration(postMessage)

    for (const nextOutcome of ['saved', 'cancelled', 'failed'] as const) {
      outcome = nextOutcome
      await act(async () => { result.current.mutate() })
      await waitFor(() => assert.equal(result.current.status, outcome === 'failed' ? 'error' : 'success'))
      assert.equal(result.current.data, outcome === 'failed' ? undefined : outcome)
      act(() => result.current.reset())
      await waitFor(() => assert.equal(result.current.status, 'idle'))
    }

    assert.equal(postMessage.mock.calls.length, 3)
    outcome = 'saved'
    await act(async () => { assert.equal(await result.current.mutateAsync(), 'saved') })
    assert.equal(result.current.data, 'saved')
  })

  it('exposes delivery errors and permits a later attempt', async () => {
    const postMessage = vi.fn(() => { throw new Error('Unavailable') })
    const { result } = renderConfiguration(postMessage)

    await act(async () => { result.current.mutate() })
    await waitFor(() => assert.equal(result.current.error?.reason, 'delivery-failed'))
    await act(async () => {
      await assert.rejects(result.current.mutateAsync(), { reason: 'delivery-failed' })
    })
    assert.equal(postMessage.mock.calls.length, 2)
  })

  it('aborts pending transport work on unmount', async () => {
    const postMessage = vi.fn()
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { result, unmount } = renderConfiguration(postMessage)
    let pending!: Promise<'saved' | 'cancelled'>

    act(() => { pending = result.current.mutateAsync() })
    const rejection = assert.rejects(pending, { reason: 'cancelled' })

    await waitFor(() => assert.equal(postMessage.mock.calls.length, 1))
    const listener = add.mock.calls.find(([type]) => type === 'message')?.[1]

    assert.ok(listener)
    unmount()
    await rejection
    assert.ok(remove.mock.calls.some(([type, callback]) => type === 'message' && callback === listener))
  })
})
