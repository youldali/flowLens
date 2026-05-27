import type { Node } from 'reactflow'
import { createFixture } from '@flowlens/test-utils'

import type { GraphViewNodeData } from '../presentation/toReactFlow.ts'

const nodeFixture: Node<GraphViewNodeData> = {
  id: 'fixture-node',
  data: {
    label: 'fixture-node',
    kind: 'file',
    filePath: 'fixture.ts',
  },
  position: { x: 0, y: 0 },
}

export const create = createFixture<Node<GraphViewNodeData>>(nodeFixture)
