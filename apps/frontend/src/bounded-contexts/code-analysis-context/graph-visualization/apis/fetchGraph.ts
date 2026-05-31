import { useQuery, type UseQueryResult } from 'react-query'
import { fromFetchError, type QueryError } from '@common/utils/queryError';
import type { Graph } from '@flowlens/graph-model'

export async function fetchGraph(fetcher: typeof fetch = fetch): Promise<Graph> {
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

  return await response.json() as Graph
  } catch (error) {
    throw fromFetchError(request, error instanceof Error ? error : new Error('Unknown error occurred while fetching graph'));
  }
}

export function useFetchGraph(): UseQueryResult<Graph, QueryError<unknown>> {
  return useQuery<Graph, QueryError<unknown>>('graph', () => fetchGraph())
}
