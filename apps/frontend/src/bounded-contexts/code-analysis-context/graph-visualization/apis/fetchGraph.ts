import { useQuery, type UseQueryResult } from 'react-query'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { getConfig } from '@common/config'
import { useConfig } from '@common/hooks/useConfig'
import { fromFetchError, type QueryError } from '@common/utils/queryError'

export interface FetchGraphOptions {
  baseUrl?: string
}

export async function fetchGraph(
  fetcher: typeof fetch = fetch,
  options: FetchGraphOptions = {},
): Promise<FlowGraph> {
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

    return await response.json() as FlowGraph
  } catch (error) {
    throw await fromFetchError(
      request,
      error instanceof Error ? error : new Error('Unknown error occurred while fetching graph'),
    )
  }
}

export function useFetchGraph(): UseQueryResult<FlowGraph, QueryError<unknown>> {
  const { apiBaseUrl } = useConfig()

  return useQuery<FlowGraph, QueryError<unknown>>('graph', () => fetchGraph(fetch, { baseUrl: apiBaseUrl }))
}
