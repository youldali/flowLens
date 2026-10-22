// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { createVsCodeEvent } from '@flowlens/registries/vscode-events'
import { AppShell } from '#common/test-utils/appShell.tsx'
import { useGenerateGraph } from './useGenerateGraph'

afterEach(cleanup)

describe('useGenerateGraph', () => {
  it('exposes delivery failures through state and mutateAsync, then clears them on success', async () => {
    const cause = new Error('Unavailable')
    const postMessage = vi.fn<(message: unknown) => void>(() => { throw cause })
    const { result } = renderHook(useGenerateGraph, {
      wrapper: ({ children }) => (
        <AppShell config={{ runtimeHost: 'vscode', vscodeApi: { postMessage } }}>{children}</AppShell>
      ),
    })

    await act(async () => { result.current.mutate() })
    await waitFor(() => assert.equal(result.current.isError, true))
    assert.equal(result.current.error?.reason, 'delivery-failed')
    assert.equal(result.current.error?.originalError, cause)
    assert.equal(postMessage.mock.calls.length, 1)
    await act(async () => {
      await assert.rejects(result.current.mutateAsync(), {
        reason: 'delivery-failed', operation: 'graph.generate', cause,
      })
    })
    assert.equal(postMessage.mock.calls.length, 2)

    postMessage.mockImplementation(() => undefined)
    await act(async () => { await result.current.mutateAsync() })
    await waitFor(() => assert.equal(result.current.isSuccess, true))
    assert.equal(result.current.error, null)
    assert.equal(postMessage.mock.calls.length, 3)
    assert.deepEqual(postMessage.mock.lastCall, [createVsCodeEvent('graph.generate', {})])
  })
})
