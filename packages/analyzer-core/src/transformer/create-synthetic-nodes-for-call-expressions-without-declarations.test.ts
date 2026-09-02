import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import { createCallExpressionNode, createNode } from '../fixtures/node.js';
import { createSyntheticNodesForCallExpressionsWithoutDeclarations } from './create-synthetic-nodes-for-call-expressions-without-declarations.js';

describe("createSyntheticNodesForCallExpressionsWithoutDeclarations", () => {
  it("derives useful names and deterministic call-site IDs", () => {
    const caller = createNode({ id: "caller" });
    const calls = [
      createCallExpressionNode({ id: "identifier", name: " foo ", start: 1, end: 6, text: "foo()" }),
      createCallExpressionNode({ id: "property", name: "service.run", start: 7, end: 20, text: "service.run()" }),
      createCallExpressionNode({ id: "computed", name: "obj[key]", start: 21, end: 31, text: "obj[key]()" }),
      createCallExpressionNode({ id: "complex", name: " ", start: 32, end: 48, text: "(getHandler())()" }),
    ];
    const graph: FlowGraph = {
      nodes: [caller, ...calls],
      edges: calls.map((call) => createEdge(caller.id, call.id, 'calls')),
    };

    const result = createSyntheticNodesForCallExpressionsWithoutDeclarations(graph);

    assert.equal(result.nodes.length, graph.nodes.length + calls.length);
    assert.equal(result.edges.length, graph.edges.length + calls.length);

    for (const node of graph.nodes) {
      assert.deepEqual(result.nodes.find((candidate) => candidate.id === node.id), node);
    }

    for (const edge of graph.edges) {
      assert.deepEqual(result.edges.find((candidate) => candidate.id === edge.id), edge);
    }

    assert.deepEqual(
      new Map(result.nodes
        .filter((node) => node.kind === 'unresolved-call-declaration')
        .map((node) => [node.id, node.name])),
      new Map([
        ['unresolved-call-declaration:identifier', 'foo'],
        ['unresolved-call-declaration:property', 'service.run'],
        ['unresolved-call-declaration:computed', 'obj[key]'],
        ['unresolved-call-declaration:complex', '(getHandler())()'],
      ]),
    );
  });

  it("keeps same-name call sites and their declaration targets distinct", () => {
    const caller = createNode({ id: "caller" });
    const firstCall = createCallExpressionNode({ id: "src/a.ts:1:6", name: "foo" });
    const secondCall = createCallExpressionNode({ id: "src/b.ts:1:6", name: "foo" });
    const graph: FlowGraph = {
      nodes: [caller, firstCall, secondCall],
      edges: [
        createEdge(caller.id, firstCall.id, 'calls'),
        createEdge(caller.id, secondCall.id, 'calls'),
      ],
    };

    const result = createSyntheticNodesForCallExpressionsWithoutDeclarations(graph);

    assert.deepEqual(
      new Set(result.nodes
        .filter((node) => node.kind === 'unresolved-call-declaration')
        .map((node) => node.id)),
      new Set([
        'unresolved-call-declaration:src/a.ts:1:6',
        'unresolved-call-declaration:src/b.ts:1:6',
      ]),
    );
    assert.deepEqual(
      new Set(result.edges
        .filter((edge) => edge.type === 'references')
        .map((edge) => `${edge.source}->${edge.target}`)),
      new Set([
        'src/a.ts:1:6->unresolved-call-declaration:src/a.ts:1:6',
        'src/b.ts:1:6->unresolved-call-declaration:src/b.ts:1:6',
      ]),
    );
  });
});
