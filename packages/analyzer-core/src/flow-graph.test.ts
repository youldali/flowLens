import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GraphBuilder } from './flow-graph.js';
import { create as createEdge } from './fixtures/edge.js';
import { createCallExpressionNode } from './fixtures/node.js';

describe("GraphBuilder.extract", () => {
  it("returns a JSON-safe graph without analyzer-only node fields", () => {
    const node = createCallExpressionNode();
    const edge = createEdge({
      id: "fixture.ts:33:45->fixture.ts:1:49:references",
      source: "fixture.ts:33:45",
      target: "fixture.ts:1:49",
      type: "references",
    });
    const graphBuilder = Object.assign(Object.create(GraphBuilder.prototype), {
      nodes: new Map([[node.id, node]]),
      edges: new Map([[edge.id, edge]]),
    }) as GraphBuilder;

    assert.deepEqual(graphBuilder.extract(), {
      nodes: [
        {
          id: "fixture.ts:33:45",
          kind: "callExpression",
          name: "dependency",
          filePath: "fixture.ts",
        },
      ],
      edges: [edge],
    });
  });
});
