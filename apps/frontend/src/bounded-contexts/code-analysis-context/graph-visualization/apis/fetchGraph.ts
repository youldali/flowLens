import type { Graph } from '@flowlens/graph-model'

export async function fetchGraph(fetcher: typeof fetch = fetch): Promise<Graph> {
  const response = await fetcher('/graph.json')

  if (!response.ok) {
    throw new Error(`Failed to load graph: ${response.status} ${response.statusText}`)
  }

  return await response.json() as Graph
}
