import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { fetchGraph } from './fetchGraph.ts'

describe('fetchGraph', () => {
  it('loads graph data from the graph endpoint', async () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: 'src/index.ts',
          kind: 'file',
          name: 'index.ts',
          filePath: 'src/index.ts',
          sourceOrigin: 'project',
        },
      ],
      edges: [],
    }
    const fetcher: typeof fetch = async (url) => {
      assert.equal(url instanceof Request ? url.url : url, 'http://localhost/graph.json')
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
      /API request failure: Server error, Internal Server Error, 500 GET http:\/\/localhost\/graph\.json/,
    )
  })

  it('uses the configured base URL when provided', async () => {
    const graph: FlowGraph = {
      nodes: [],
      edges: [],
    }
    const fetcher: typeof fetch = async (url) => {
      assert.equal(url instanceof Request ? url.url : url, 'https://flowlens.test/graph.json')
      return Response.json(graph)
    }

    assert.deepEqual(await fetchGraph(fetcher, { baseUrl: 'https://flowlens.test' }), graph)
  })
})
