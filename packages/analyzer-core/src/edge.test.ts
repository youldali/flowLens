import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { create } from './edge.js';
import { createCallExpressionEdgeMetadata } from './fixtures/edge.js';

describe("create", () => {
  it("creates an edge with a deterministic id", () => {
    const edge = create("source-node", "target-node", "calls");

    assert.deepEqual(edge, {
      id: "source-node->target-node:calls",
      source: "source-node",
      target: "target-node",
      type: "calls",
    });
  });

  it("creates an edge with call expression metadata", () => {
    const metadata = createCallExpressionEdgeMetadata();

    const edge = create("source-node", "target-node", "calls", metadata);

    assert.deepEqual(edge, {
      id: "source-node->target-node:calls:call-expression:src/source.ts:12:24",
      source: "source-node",
      target: "target-node",
      type: "calls",
      metadata,
    });
  });

  it("creates different ids for different call sites on the same edge", () => {
    const firstEdge = create("source-node", "target-node", "calls", createCallExpressionEdgeMetadata());
    const secondEdge = create("source-node", "target-node", "calls", createCallExpressionEdgeMetadata({
      callSite: {
        filePath: 'src/source.ts',
        start: 36,
        end: 48,
      },
    }));

    assert.notEqual(firstEdge.id, secondEdge.id);
  });
});
