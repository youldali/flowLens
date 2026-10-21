import { useQuery, type UseQueryResult } from 'react-query'
import type { GraphSession } from '@flowlens/analyzer-core/domain/graph-session'
import { getConfig, useConfig } from '#common/config/index.ts'
import { fromFetchError, type HttpQueryError } from '#common/utils/QueryError/index.ts'

export interface FetchGraphOptions {
  baseUrl?: string
}

export async function fetchGraph(
  fetcher: typeof fetch = fetch,
  options: FetchGraphOptions = {},
): Promise<GraphSession> {
  const request = new Request(new URL('/graph.json', options.baseUrl ?? getConfig().apiBaseUrl), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  try {
    const response = await fetcher(request)

    if (!response.ok) {
      throw await fromFetchError(request, response)
    }

    return await response.json() as GraphSession
  } catch (error) {
    throw await fromFetchError(
      request,
      error instanceof Error ? error : new Error('Unknown error occurred while fetching graph'),
    )
  }
}

export function useFetchGraph(): UseQueryResult<GraphSession, HttpQueryError<unknown>> {
  const { apiBaseUrl } = useConfig()

  return useQuery<GraphSession, HttpQueryError<unknown>>(
    ['graph', { apiBaseUrl }],
    () => fetchGraph(fetch, { baseUrl: apiBaseUrl }),
  )
}
