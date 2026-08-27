import type { CallExpressionEdgeMetadata, Edge } from '../edge.js';
import { createFixture } from '@flowlens/test-utils';

const edgeFixture: Edge = {
  id: "source-node->target-node:calls",
  source: "source-node",
  target: "target-node",
  type: "calls",
};

const callExpressionEdgeMetadataFixture: CallExpressionEdgeMetadata = {
  kind: 'call-expression',
  callSite: {
    filePath: 'src/source.ts',
    start: 12,
    end: 24,
    text: 'dependency()',
  },
};

export const create = createFixture<Edge>(edgeFixture);
export const createCallExpressionEdgeMetadata = createFixture<CallExpressionEdgeMetadata>(callExpressionEdgeMetadataFixture);
