// @vitest-environment jsdom

import assert from 'node:assert/strict'
import type { SerializedError } from '@reduxjs/toolkit'
import {
  QueryStatus,
  type BaseQueryFn,
  type TypedUseLazyQueryStateResult,
  type TypedUseQueryHookResult,
  type TypedUseQueryStateResult,
} from '@reduxjs/toolkit/query/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expectTypeOf, it, vi } from 'vitest'
import { QuerySuspenseRtkAdapter } from './QuerySuspenseRtkAdapter'

afterEach(cleanup)

const waiting = {
  status: QueryStatus.pending,
  isUninitialized: false as const,
  isLoading: true as const,
  isFetching: true as const,
  isError: false as const,
  isSuccess: false as const,
  data: undefined,
}

const idle = {
  ...waiting,
  status: QueryStatus.uninitialized as const,
  isUninitialized: true as const,
  isLoading: false as const,
  isFetching: false as const,
}

function success<T>(data: T) {
  return {
    ...waiting,
    status: QueryStatus.fulfilled,
    isLoading: false as const,
    isFetching: false as const,
    isSuccess: true as const,
    data,
    currentData: data,
    error: undefined,
    fulfilledTimeStamp: 1,
  }
}

function failure<T>(error: ApiError, data?: T) {
  return {
    ...waiting,
    status: QueryStatus.rejected,
    isLoading: false as const,
    isFetching: false as const,
    isError: true as const,
    error,
    ...(data === undefined ? {} : { data }),
  }
}

type Item = { name: string }
type ApiError = { reason: string }
type TestBaseQuery = BaseQueryFn<string, Item, ApiError>
type ItemQueryState = TypedUseQueryStateResult<Item, string, TestBaseQuery>

describe('QuerySuspenseRtkAdapter', () => {
  it('renders idle or nothing before initialization', () => {
    const props = {
      queryState: idle,
      loading: <p>Loading</p>,
      fallback: vi.fn(() => null),
      children: vi.fn(() => null),
    }
    const view = render(<QuerySuspenseRtkAdapter {...props} idle={<p>Idle</p>} />)
    assert.ok(screen.getByText('Idle'))
    view.rerender(<QuerySuspenseRtkAdapter {...props} />)
    assert.equal(view.container.innerHTML, '')
    assert.equal(props.children.mock.calls.length, 0)
    assert.equal(props.fallback.mock.calls.length, 0)
  })

  it('transitions from loading to data to error and passes errors through unchanged', () => {
    const fallback = vi.fn((error: ItemQueryState['error']) => <p>{error && 'reason' in error ? error.reason : 'Failed'}</p>)
    const children = vi.fn((data: Item) => <p>{data.name}</p>)
    const props = { loading: <p>Loading</p>, fallback, children }
    const data = { name: 'Graph' }
    const error = { reason: 'Failed' }
    const view = render(
      <QuerySuspenseRtkAdapter<ItemQueryState>
        {...props} queryState={{ ...waiting, isLoading: true }}
      />,
    )
    assert.ok(screen.getByText('Loading'))
    assert.equal(children.mock.calls.length, 0)
    view.rerender(
      <QuerySuspenseRtkAdapter<ItemQueryState> {...props} queryState={success(data)} />,
    )
    assert.ok(screen.getByText('Graph'))
    assert.equal(children.mock.calls.at(-1)?.[0], data)
    for (const cachedData of [data, undefined]) {
      view.rerender(
        <QuerySuspenseRtkAdapter<ItemQueryState> {...props}
          queryState={failure(error, cachedData)}
        />,
      )
      assert.ok(screen.getByText('Failed'))
      assert.equal(screen.queryByText('Graph'), null)
      assert.equal(fallback.mock.calls.at(-1)?.[0], error)
    }
  })

  it('keeps retained data during fetching and loads when no data is available', () => {
    const view = render(<div />)
    for (const isFetching of [true, false] as const) {
      const queryState = {
        ...success('Retained'), isFetching,
      }
      view.rerender(
        <QuerySuspenseRtkAdapter queryState={queryState}
          loading={<p>Loading</p>} fallback={() => null}
        >
          {(data) => <p>{data}</p>}
        </QuerySuspenseRtkAdapter>,
      )
      assert.ok(screen.getByText('Retained'))
      assert.equal(screen.queryByText('Loading'), null)
    }
    view.rerender(
      <QuerySuspenseRtkAdapter queryState={waiting}
        loading={<p>Loading</p>} fallback={() => null}
      >
        {() => <p>Unexpected</p>}
      </QuerySuspenseRtkAdapter>,
    )
    assert.ok(screen.getByText('Loading'))
  })

  it('passes falsy successful data to children and permits null rendering', () => {
    const view = render(<div />)
    for (const data of [0, false, null, '', undefined]) {
      const children = vi.fn(() => null)
      view.rerender(
        <QuerySuspenseRtkAdapter queryState={success(data)}
          loading={null} fallback={() => null}
        >
          {children}
        </QuerySuspenseRtkAdapter>,
      )
      assert.deepEqual(children.mock.calls.at(-1), [data])
      assert.equal(view.container.innerHTML, '')
    }
    for (const queryState of [
      waiting,
      idle,
      failure({ reason: 'Failed' }),
    ]) {
      view.rerender(
        <QuerySuspenseRtkAdapter queryState={queryState} idle={null}
          loading={null} fallback={() => null}
        >
          {() => <p>Unexpected</p>}
        </QuerySuspenseRtkAdapter>,
      )
      assert.equal(view.container.innerHTML, '')
    }
  })

  it('infers data and error types from public standard and lazy hook results', () => {
    function checkResult(queryState:
      | TypedUseQueryHookResult<Item, string, TestBaseQuery>
      | TypedUseLazyQueryStateResult<Item, string, TestBaseQuery>
    ) {
      return (
        <QuerySuspenseRtkAdapter queryState={queryState} loading={null}
          fallback={(error) => {
            // RTK's public hook result also permits undefined in its error branch.
            expectTypeOf(error).toEqualTypeOf<ApiError | SerializedError | undefined>()
            return null
          }}
        >
          {(data) => {
            expectTypeOf(data).toEqualTypeOf<Item>()
            return <p>{data.name}</p>
          }}
        </QuerySuspenseRtkAdapter>
      )
    }
    expectTypeOf(checkResult).toBeFunction()
  })
})
