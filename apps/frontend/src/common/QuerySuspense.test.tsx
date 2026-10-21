// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { cleanup, render, screen } from '@testing-library/react'
import type { UseQueryResult } from 'react-query'
import { afterEach, describe, it, vi } from 'vitest'
import { QuerySuspense } from './QuerySuspense'

afterEach(cleanup)

// QuerySuspense consumes only these fields from the query result.
function state<T>(status: UseQueryResult<T, Error>['status'], data?: T, isFetching = false): UseQueryResult<T, Error> {
  return { status, data, isFetching, error: new Error('Failed') } as UseQueryResult<T, Error>
}

describe('QuerySuspense', () => {
  it('preserves idle, loading, success and default error rendering', () => {
    const children = vi.fn((data: string) => <p>{data}</p>)
    const fallback = vi.fn((error: Error) => <p>{error.message}</p>)
    const props = { children, fallback, loading: <p>Loading</p> }
    const view = render(<QuerySuspense {...props} queryState={state<string>('idle')} />)
    assert.equal(view.container.innerHTML, '')
    view.rerender(<QuerySuspense {...props} queryState={state<string>('idle')} idle={<p>Idle</p>} />)
    screen.getByText('Idle')
    view.rerender(<QuerySuspense {...props} queryState={state<string>('loading')} />)
    screen.getByText('Loading')
    assert.equal(children.mock.calls.length, 0)
    assert.equal(fallback.mock.calls.length, 0)
    view.rerender(<QuerySuspense {...props} queryState={state('success', 'Retained')} />)
    screen.getByText('Retained')
    const failure = state('error', 'Retained')
    view.rerender(<QuerySuspense {...props} queryState={failure} />)
    screen.getByText('Failed')
    assert.equal(screen.queryByText('Retained'), null)
    assert.equal(fallback.mock.calls.at(-1)?.[0], failure.error)
  })

  it('uses separate initial and refetch indicators, retaining data and hiding stale errors', () => {
    const fallback = vi.fn(() => <p>Failed</p>)
    const children = vi.fn((data: number) => <p>Value: {data}</p>)
    const props = { fallback, children, loading: <p role="status">Loading</p>, refetching: <p role="status">Refreshing</p> }
    const view = render(<QuerySuspense {...props} queryState={state<number>('loading', undefined, true)} />)
    assert.equal(screen.getAllByRole('status').length, 1)
    assert.equal(children.mock.calls.length, 0)
    screen.getByText('Loading')
    assert.equal(screen.queryByText('Refreshing'), null)

    for (const status of ['success', 'error'] as const) {
      view.rerender(<QuerySuspense {...props} queryState={state(status, 0, true)} />)
      assert.equal(screen.getAllByRole('status').length, 1)
      screen.getByText('Refreshing')
      assert.equal(screen.queryByText('Loading'), null)
      screen.getByText('Value: 0')
      assert.equal(fallback.mock.calls.length, 0)
    }

    view.rerender(<QuerySuspense {...props} queryState={state('success', 1)} />)
    assert.equal(screen.queryByRole('status'), null)
    screen.getByText('Value: 1')

    view.rerender(<QuerySuspense {...props} keepDataOnError queryState={state('error', 1)} />)
    screen.getByText('Failed')
    screen.getByText('Value: 1')
    assert.equal(screen.queryByRole('status'), null)
  })

  it('keeps data without an indicator when refetching is omitted or null', () => {
    const props = {
      queryState: state('success', 'Retained', true),
      loading: <p>Initial loading</p>,
      fallback: () => null,
      children: (data: string) => <p>{data}</p>,
    }
    const view = render(<QuerySuspense {...props} />)
    assert.equal(view.container.textContent, 'Retained')
    view.rerender(<QuerySuspense {...props} refetching={null} />)
    assert.equal(view.container.textContent, 'Retained')
  })

  it('retains even falsy data alongside errors only when enabled', () => {
    const view = render(<div />)
    for (const data of ['Retained', 0, false, '', null]) {
      const children = vi.fn((value: typeof data) => <p data-testid="data">{String(value)}</p>)
      view.rerender(
        <QuerySuspense queryState={state('error', data)} keepDataOnError loading={null} fallback={() => <p>Failed</p>}>
          {children}
        </QuerySuspense>,
      )
      screen.getByText('Failed')
      assert.equal(screen.getByTestId('data').textContent, String(data))
      assert.deepEqual(children.mock.calls.at(-1), [data])
    }
    const children = vi.fn(() => <p>Unexpected</p>)
    view.rerender(
      <QuerySuspense queryState={state('error')} keepDataOnError loading={null} fallback={() => <p>Failed</p>}>
        {children}
      </QuerySuspense>,
    )
    screen.getByText('Failed')
    assert.equal(children.mock.calls.length, 0)
    view.rerender(
      <QuerySuspense queryState={state('error', 'Retained')} keepDataOnError loading={null} fallback={() => null}>
        {data => <p>{data}</p>}
      </QuerySuspense>,
    )
    screen.getByText('Retained')
    assert.equal(screen.queryByText('Failed'), null)
  })
})
