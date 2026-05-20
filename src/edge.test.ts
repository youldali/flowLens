import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { create } from './edge.js';

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
});
