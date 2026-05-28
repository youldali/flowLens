import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Graph } from '@flowlens/graph-model'
import { fetchGraph } from './fetchGraph.ts'

describe('fetchGraph', () => {
  it('loads graph data from the graph endpoint', async () => {
    const graph: Graph = {
      nodes: [
        {
          id: 'src/index.ts',
          kind: 'file',
          name: 'index.ts',
          filePath: 'src/index.ts',
        },
      ],
      edges: [],
    }
    const fetcher: typeof fetch = async (url) => {
      assert.equal(url, '/graph.json')
      return Response.json(graph)
    }

    assert.deepEqual(await fetchGraph(fetcher), graph)
  })

  it('throws when graph data cannot be loaded', async () => {
    const fetcher: typeof fetch = async () => new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    })

    await assert.rejects(
      fetchGraph(fetcher),
      /Failed to load graph: 500 Internal Server Error/,
    )
  })
})
