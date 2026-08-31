import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import { createCallExpressionNode, createNode } from '../fixtures/node.js';
import { toFlowGraph } from './index.js';

describe("toFlowGraph", () => {
  it("removes resolved call expression nodes and bridges callers to declarations with call-site metadata", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const call = createCallExpressionNode({ id: "call", filePath: "src/source.ts", start: 12, end: 24, text: "callee()" });
    const declaration = createNode({ id: "declaration", name: "callee" });
    const graph: FlowGraph = {
      nodes: [caller, call, declaration],
      edges: [
        createEdge(caller.id, call.id, 'calls'),
        createEdge(call.id, declaration.id, 'references'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(result.nodes, [caller, declaration]);
    assert.deepEqual(result.edges, [
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: "src/source.ts",
          start: 12,
          end: 24,
          text: "callee()",
        },
      }),
    ]);
  });

  it("keeps unresolved call expression nodes", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const call = createCallExpressionNode({ id: "call" });
    const graph: FlowGraph = {
      nodes: [caller, call],
      edges: [
        createEdge(caller.id, call.id, 'calls'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(result, graph);
  });

  it("does not bridge non-reference outgoing edges from removed call expression nodes", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const call = createCallExpressionNode({ id: "call", filePath: "src/source.ts", start: 12, end: 24, text: "callee()" });
    const declaration = createNode({ id: "declaration", name: "callee" });
    const nestedCall = createCallExpressionNode({ id: "nested-call" });
    const graph: FlowGraph = {
      nodes: [caller, call, declaration, nestedCall],
      edges: [
        createEdge(caller.id, call.id, 'calls'),
        createEdge(call.id, declaration.id, 'references'),
        createEdge(call.id, nestedCall.id, 'calls'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(result.nodes, [caller, declaration, nestedCall]);
    assert.deepEqual(result.edges, [
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: "src/source.ts",
          start: 12,
          end: 24,
          text: "callee()",
        },
      }),
    ]);
  });

  it("preserves multiple call sites from one caller to the same declaration", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const firstCall = createCallExpressionNode({ id: "first-call", start: 12, end: 24, text: "callee()" });
    const secondCall = createCallExpressionNode({ id: "second-call", start: 36, end: 48, text: "callee()" });
    const declaration = createNode({ id: "declaration", name: "callee" });
    const graph: FlowGraph = {
      nodes: [caller, firstCall, secondCall, declaration],
      edges: [
        createEdge(caller.id, firstCall.id, 'calls'),
        createEdge(firstCall.id, declaration.id, 'references'),
        createEdge(caller.id, secondCall.id, 'calls'),
        createEdge(secondCall.id, declaration.id, 'references'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(result.nodes, [caller, declaration]);
    assert.deepEqual(result.edges, [
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: "fixture.ts",
          start: 12,
          end: 24,
          text: "callee()",
        },
      }),
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: "fixture.ts",
          start: 36,
          end: 48,
          text: "callee()",
        },
      }),
    ]);
  });
});
