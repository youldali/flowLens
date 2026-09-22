import type { BaseQueryFn, TypedUseQueryStateResult } from '@reduxjs/toolkit/query/react'
import type { ReactElement } from 'react'

type RtkQueryState = TypedUseQueryStateResult<unknown, unknown, BaseQueryFn>
type TData<TQuery extends RtkQueryState> = Extract<TQuery, { isSuccess: true }>['data']

type QuerySuspenseRtkAdapterProps<TQuery extends RtkQueryState> = {
  queryState: TQuery
  fallback: (error: TQuery['error']) => ReactElement | null
  loading: ReactElement | null
  idle?: ReactElement | null
  children: (data: TData<TQuery>) => ReactElement | null
}

export function QuerySuspenseRtkAdapter<TQuery extends RtkQueryState>({
  queryState,
  fallback,
  loading,
  idle,
  children,
}: QuerySuspenseRtkAdapterProps<TQuery>) {
  if (queryState.isUninitialized) {
    return idle ?? null
  }
  if (queryState.isLoading) {
    return loading
  }
  if (queryState.isError) {
    return fallback(queryState.error)
  }
  // The guards establish success; TypeScript cannot narrow the generic TQuery itself.
  return children(queryState.data as TData<TQuery>)
}
