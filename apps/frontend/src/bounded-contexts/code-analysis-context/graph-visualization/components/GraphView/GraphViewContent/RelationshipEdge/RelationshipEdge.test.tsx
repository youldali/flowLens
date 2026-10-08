import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'vitest'
import { Position } from 'reactflow'
import { AppShell } from '@common/test-utils/appShell'
import { GraphProvider } from '@code-analysis-context/graph-visualization/context'
import { RelationshipEdge } from './RelationshipEdge'

describe('RelationshipEdge', () => {
  it('distinguishes relationship types independently of labels while preserving arrows and styles', () => {
    for (const [relationship, strokeDasharray] of [
      ['calls', 'none'],
      ['declares', '6 4'],
      ['imports', 'none'],
      ['references', 'none'],
    ] as const) {
      const markup = renderToStaticMarkup(
        <AppShell>
          <GraphProvider graph={{ nodes: [], edges: [] }}>
            <svg>
              <RelationshipEdge
                id="connection"
                source="source"
                target="target"
                sourceX={0}
                sourceY={0}
                targetX={280}
                targetY={150}
                sourcePosition={Position.Right}
                targetPosition={Position.Left}
                data={{ relationship }}
                label="Translated relationship"
                markerEnd="url(#target-arrow)"
                style={{ opacity: 0.5 }}
              />
            </svg>
          </GraphProvider>
        </AppShell>,
      )

      assert.ok(markup.includes(`stroke-dasharray:${strokeDasharray}`))
      assert.ok(markup.includes('marker-end="url(#target-arrow)"'))
      assert.ok(markup.includes('opacity:0.5'))
      assert.ok(markup.includes('Translated relationship'))
      assert.ok(markup.includes('react-flow__edge-interaction'))
    }
  })
})
