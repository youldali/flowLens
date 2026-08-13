import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { AnalyzerGraph } from '../flow-graph.js';
import { createCallExpressionNode, createFileNode, createFunctionDeclarationNode } from '../fixtures/node.js';
import { toReadableAnalyzerGraph } from './index.js';

describe("toReadableAnalyzerGraph", () => {
  it("removes file nodes and bridges the remaining graph", () => {
    const file = createFileNode({ id: "file", name: "file.ts" });
    const declaration = createFunctionDeclarationNode({ id: "declaration", name: "declaration" });
    const call = createCallExpressionNode({ id: "call", name: "call" });
    const graph: AnalyzerGraph = {
      nodes: [file, declaration, call],
      edges: [
        createEdge(declaration.id, file.id, 'declares'),
        createEdge(file.id, call.id, 'calls'),
      ],
    };

    const result = toReadableAnalyzerGraph(graph);

    assert.deepEqual(result.nodes, [declaration, call]);
    assert.deepEqual(result.edges, [
      createEdge(declaration.id, call.id, 'declares'),
    ]);
  });
});
