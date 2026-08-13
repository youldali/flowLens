import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { AnalyzerGraph } from '../flow-graph.js';
import { createCallExpressionNode, createFunctionDeclarationNode } from '../fixtures/node.js';
import { toProjectSourceGraph } from './index.js';

describe("toProjectSourceGraph", () => {
  it("removes external nodes and keeps project and unknown nodes", () => {
    const source = createFunctionDeclarationNode({
      id: "source",
      name: "source",
      sourceOrigin: "project",
    });
    const external = createCallExpressionNode({
      id: "external",
      name: "values.map",
      sourceOrigin: "external",
    });
    const unknown = createCallExpressionNode({
      id: "unknown",
      name: "unresolved",
      sourceOrigin: "unknown",
    });
    const graph: AnalyzerGraph = {
      nodes: [source, external, unknown],
      edges: [
        createEdge(source.id, external.id, 'calls'),
        createEdge(external.id, unknown.id, 'calls'),
      ],
    };

    const result = toProjectSourceGraph(graph);

    assert.deepEqual(result.nodes, [source, unknown]);
    assert.deepEqual(result.edges, [
      createEdge(source.id, unknown.id, 'calls'),
    ]);
  });
});
