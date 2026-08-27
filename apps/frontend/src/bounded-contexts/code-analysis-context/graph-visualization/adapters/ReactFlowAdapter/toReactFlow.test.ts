import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { MarkerType } from 'reactflow'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

import { toReactFlow } from './toReactFlow.ts'

describe('toReactFlow', () => {
  it('maps graph nodes and edges to React Flow elements', () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: 'src/index.ts',
          kind: 'file',
          name: 'index.ts',
          filePath: 'src/index.ts',
          sourceOrigin: 'project',
        },
        {
          id: 'src/index.ts:1:12',
          kind: 'functionDeclaration',
          name: 'main',
          filePath: 'src/index.ts',
          sourceOrigin: 'project',
        },
      ],
      edges: [
        {
          id: 'src/index.ts->src/index.ts:1:12:declares',
          source: 'src/index.ts',
          target: 'src/index.ts:1:12',
          type: 'declares',
        },
      ],
    }

    assert.deepEqual(toReactFlow(graph), {
      nodes: [
        {
          id: 'src/index.ts',
          data: {
            label: 'index.ts',
            kind: 'file',
            filePath: 'src/index.ts',
            sourceOrigin: 'project',
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'src/index.ts:1:12',
          data: {
            label: 'main',
            kind: 'functionDeclaration',
            filePath: 'src/index.ts',
            sourceOrigin: 'project',
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

  it('maps graph edge metadata to React Flow edge data', () => {
    const graph: FlowGraph = {
      nodes: [],
      edges: [
        {
          id: 'src/index.ts:1:12->src/dependency.ts:1:12:calls:call-expression:src/index.ts:12:24',
          source: 'src/index.ts:1:12',
          target: 'src/dependency.ts:1:12',
          type: 'calls',
          metadata: {
            kind: 'call-expression',
            callSite: {
              filePath: 'src/index.ts',
              start: 12,
              end: 24,
              text: 'dependency()',
            },
          },
        },
      ],
    }

    assert.deepEqual(toReactFlow(graph).edges, [
      {
        id: 'src/index.ts:1:12->src/dependency.ts:1:12:calls:call-expression:src/index.ts:12:24',
        source: 'src/index.ts:1:12',
        target: 'src/dependency.ts:1:12',
        label: 'calls',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        type: 'smoothstep',
        animated: false,
        data: {
          metadata: {
            kind: 'call-expression',
            callSite: {
              filePath: 'src/index.ts',
              start: 12,
              end: 24,
              text: 'dependency()',
            },
          },
        },
      },
    ])
  })
})
