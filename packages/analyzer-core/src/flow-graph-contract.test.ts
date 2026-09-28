import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flowGraphSchema } from './flow-graph-contract.js';
import { create as createNode } from './fixtures/node.js';

describe('flowGraphSchema', () => {
  it('preserves presentation names while accepting legacy nodes', () => {
    const graph = {
      nodes: [createNode({ name: 'anonymous', displayName: 'click handler' }), createNode({ id: 'legacy' })],
      edges: [],
    };
    assert.deepEqual(flowGraphSchema.parse(graph), graph);
  });
});
