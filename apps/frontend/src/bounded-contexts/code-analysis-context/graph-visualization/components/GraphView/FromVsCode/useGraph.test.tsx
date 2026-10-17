// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import type { PropsWithChildren } from 'react'
import { AppShell } from '@common/test-utils/appShell'
import { createVsCodeEvent } from '@flowlens/registries/vscode-events'
import { useGraph } from './useGraph'

afterEach(cleanup)

describe('useGraph', () => {
  it('retains the generation ID, accepts resends, and replaces successive graphs', () => {
    const sent: unknown[] = []
    const vscodeApi = { postMessage: (message: unknown) => { sent.push(message) } }
    const wrapper = ({ children }: PropsWithChildren) => <AppShell config={{ runtimeHost: 'vscode', vscodeApi }}>{children}</AppShell>
    const { result } = renderHook(useGraph, { wrapper })
    assert.deepEqual(sent, [createVsCodeEvent('view.ready', {})])
    const graph = { nodes: [], edges: [] }

    for (const graphId of ['first', 'first', 'second']) {
      act(() => { window.dispatchEvent(new MessageEvent('message', { data: createVsCodeEvent('flowgraph', { graphId, graph }) })) })
      assert.deepEqual(result.current, { graphId, graph })
    }

    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { type: 'flowgraph', payload: { graph } } })) })
    assert.equal(result.current?.graphId, 'second')
  })
})
