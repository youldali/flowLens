import type { Edge } from 'reactflow'
import { createFixture } from '@flowlens/test-utils'

import type { GraphViewNodeData } from '../presentation/toReactFlow.ts'

const edgeFixture: Edge<GraphViewNodeData> = {
  id: 'source->target',
  source: 'source',
  target: 'target',
}

export const create = createFixture<Edge<GraphViewNodeData>>(edgeFixture)
