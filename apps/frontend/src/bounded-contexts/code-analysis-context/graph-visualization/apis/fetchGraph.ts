import { useQuery, type UseQueryResult } from 'react-query'
import { fromFetchError, type QueryError } from '@common/utils/queryError';
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

export async function fetchGraph(fetcher: typeof fetch = fetch): Promise<FlowGraph> {
  const request = new Request('/graph.json', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  try {
  const response = await fetcher(request)

  if (!response.ok) {
    throw fromFetchError(request, response);
  }

  return await response.json() as FlowGraph
  } catch (error) {
    throw fromFetchError(request, error instanceof Error ? error : new Error('Unknown error occurred while fetching graph'));
  }
}

export function useFetchGraph(): UseQueryResult<FlowGraph, QueryError<unknown>> {
  return useQuery<FlowGraph, QueryError<unknown>>('graph', () => fetchGraph())
}
