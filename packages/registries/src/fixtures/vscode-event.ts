import { createFixture } from '@flowlens/test-utils';
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node';
import type { FlowGraphEvent } from '../vscode-events.js';

const flowGraphEventFixture: FlowGraphEvent = {
  type: 'flowgraph',
  payload: {
    graph: {
      nodes: [
        createFunctionDeclarationNode({
          id: 'fixture.ts:1:10',
          kind: 'functionDeclaration',
          name: 'run',
          sourceText: 'function run() {}',
          filePath: 'fixture.ts',
          fileName: 'fixture.ts',
          sourceOrigin: 'project',
        }),
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
