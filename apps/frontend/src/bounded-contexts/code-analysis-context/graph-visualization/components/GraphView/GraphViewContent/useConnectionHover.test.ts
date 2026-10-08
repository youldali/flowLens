// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { AppShell } from '@common/test-utils/appShell'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import type { MouseEvent } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { create as createEdge } from '../../../fixtures/react-flow-edge'
import { useConnectionHover } from './useConnectionHover'

const edge = createEdge({ id: 'first', source: 'source', target: 'target' })
const otherEdge = createEdge({ id: 'second', source: 'source', target: 'other' })
const event = {} as MouseEvent<SVGGElement>

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function useHoverProbe() {
  const hover = useConnectionHover()
  const highlightedEdgeId = graphFacade.data.useHighlightedEdgeId()

  return { ...hover, highlightedEdgeId }
}

describe('useConnectionHover', () => {
  it('keeps a connection highlighted while moving between its path and label, then restores normal styling', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useHoverProbe, { wrapper: AppShell })

    act(() => result.current.onEdgeMouseEnter(event, edge))
    assert.equal(result.current.highlightedEdgeId, edge.id)

    act(() => {
      result.current.onEdgeMouseLeave(event, edge)
      vi.advanceTimersByTime(100)
    })
    assert.equal(result.current.highlightedEdgeId, edge.id)
    act(() => result.current.onEdgeMouseEnter(event, edge))
    act(() => vi.advanceTimersByTime(200))
    assert.equal(result.current.highlightedEdgeId, edge.id)

    act(() => result.current.onEdgeMouseLeave(event, edge))
    act(() => vi.advanceTimersByTime(150))
    assert.equal(result.current.highlightedEdgeId, undefined)
  })

  it('switches directly between connections and clears immediately when the canvas is left', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(useHoverProbe, { wrapper: AppShell })

    act(() => {
      result.current.onEdgeMouseEnter(event, edge)
      result.current.onEdgeMouseLeave(event, edge)
      result.current.onEdgeMouseEnter(event, otherEdge)
    })
    act(() => vi.advanceTimersByTime(200))
    assert.equal(result.current.highlightedEdgeId, otherEdge.id)

    act(() => result.current.clearHover())
    assert.equal(result.current.highlightedEdgeId, undefined)

    act(() => result.current.onEdgeMouseEnter(event, otherEdge))
    act(() => result.current.onEdgeMouseLeave(event, otherEdge))

    unmount()
    assert.equal(vi.getTimerCount(), 0)
  })
})
