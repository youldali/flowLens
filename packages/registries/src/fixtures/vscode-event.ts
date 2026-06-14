import { createFixture } from '@flowlens/test-utils';
import type { FlowGraphEvent } from '../vscode-events.js';

const flowGraphEventFixture: FlowGraphEvent = {
  type: 'flowgraph',
  payload: {
    graph: {
      nodes: [
        {
          id: 'fixture.ts:1:10',
          kind: 'functionDeclaration',
          name: 'run',
          filePath: 'fixture.ts',
        },
      ],
      edges: [
        {
          id: 'fixture.ts:1:10->fixture.ts:12:20:calls',
          source: 'fixture.ts:1:10',
          target: 'fixture.ts:12:20',
          type: 'calls',
        },
      ],
    },
  },
};

export const createFlowGraphEvent = createFixture<FlowGraphEvent>(flowGraphEventFixture);
