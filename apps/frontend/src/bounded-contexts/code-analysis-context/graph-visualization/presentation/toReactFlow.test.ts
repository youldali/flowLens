import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MarkerType } from 'reactflow'
import type { Graph } from '@flowlens/graph-model'

import { toReactFlow } from './toReactFlow.ts'

describe('toReactFlow', () => {
  it('maps graph nodes and edges to React Flow elements', () => {
    const graph: Graph = {
      nodes: new Map([
        [
          'src/index.ts',
          {
            id: 'src/index.ts',
            kind: 'file',
            name: 'index.ts',
            filePath: 'src/index.ts',
          },
        ],
        [
          'src/index.ts:1:12',
          {
            id: 'src/index.ts:1:12',
            kind: 'functionDeclaration',
            name: 'main',
            filePath: 'src/index.ts',
          },
        ],
      ]),
      edges: new Map([
        [
          'src/index.ts->src/index.ts:1:12:declares',
          {
            id: 'src/index.ts->src/index.ts:1:12:declares',
            source: 'src/index.ts',
            target: 'src/index.ts:1:12',
            type: 'declares',
          },
        ],
      ]),
    }

    assert.deepEqual(toReactFlow(graph), {
      nodes: [
        {
          id: 'src/index.ts',
          data: {
            label: 'index.ts',
            kind: 'file',
            filePath: 'src/index.ts',
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'src/index.ts:1:12',
          data: {
            label: 'main',
            kind: 'functionDeclaration',
            filePath: 'src/index.ts',
          },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [
        {
          id: 'src/index.ts->src/index.ts:1:12:declares',
          source: 'src/index.ts',
          target: 'src/index.ts:1:12',
          label: 'declares',
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          type: 'smoothstep',
          animated: false,
        },
      ],
    })
  })
})
