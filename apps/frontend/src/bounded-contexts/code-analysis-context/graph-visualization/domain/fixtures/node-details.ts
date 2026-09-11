import { createFixture } from '@flowlens/test-utils'

import type { GraphNodeDetailsView } from '../nodeDetails'

const nodeDetailsFixture: GraphNodeDetailsView = {
  node: {
    id: 'database.query',
    name: 'database.query',
    kind: 'unresolved-call-declaration',
    sourceOrigin: 'project',
    fileName: 'process.ts',
    filePath: '/project/src/process.ts',
    sourceOffset: 42,
  },
  incomingConnections: [],
  outgoingConnections: [],
}

export const create = createFixture<GraphNodeDetailsView>(nodeDetailsFixture)
