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

  it("replaces unresolved call expression nodes with synthetic targets", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const call = createCallExpressionNode({ id: "call" });
    const graph: FlowGraph = {
      nodes: [caller, call],
      edges: [
        createEdge(caller.id, call.id, 'calls'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(result.nodes, [
      caller,
      {
        kind: 'unresolved-call-declaration',
        id: 'unresolved-call-declaration:call',
        name: call.name,
        filePath: call.filePath,
        sourceOrigin: call.sourceOrigin,
        start: call.start,
        end: call.end,
      },
    ]);
    assert.deepEqual(result.edges, [
      createEdge(caller.id, 'unresolved-call-declaration:call', 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: call.filePath,
          start: call.start,
          end: call.end,
          text: call.text,
        },
      }),
    ]);
  });

  it("preserves nested unresolved call declarations with their own call-site metadata", () => {
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

    assert.deepEqual(result.nodes, [
      caller,
      declaration,
      {
        kind: 'unresolved-call-declaration',
        id: `unresolved-call-declaration:${nestedCall.id}`,
        name: nestedCall.name,
        filePath: nestedCall.filePath,
        sourceOrigin: nestedCall.sourceOrigin,
        start: nestedCall.start,
        end: nestedCall.end,
      },
    ]);
    assert.deepEqual(result.edges, [
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: call.filePath,
          start: call.start,
          end: call.end,
          text: call.text,
        },
      }),
      createEdge(caller.id, `unresolved-call-declaration:${nestedCall.id}`, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: nestedCall.filePath,
          start: nestedCall.start,
          end: nestedCall.end,
          text: nestedCall.text,
        },
      }),
    ]);
  });

  it("preserves nested call sites that reference the same declaration", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const outerCall = createCallExpressionNode({
      id: "outer-call",
      start: 12,
      end: 36,
      text: "callee(callee())",
    });
    const innerCall = createCallExpressionNode({
      id: "inner-call",
      start: 19,
      end: 27,
      text: "callee()",
    });
    const declaration = createNode({ id: "declaration", name: "callee" });
    const graph: FlowGraph = {
      nodes: [caller, outerCall, innerCall, declaration],
      edges: [
        createEdge(caller.id, outerCall.id, 'calls'),
        createEdge(outerCall.id, declaration.id, 'references'),
        createEdge(outerCall.id, innerCall.id, 'calls'),
        createEdge(innerCall.id, declaration.id, 'references'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(result.nodes, [caller, declaration]);
    assert.deepEqual(result.edges, [
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: outerCall.filePath,
          start: outerCall.start,
          end: outerCall.end,
          text: outerCall.text,
        },
      }),
      createEdge(caller.id, declaration.id, 'calls', {
        kind: 'call-expression',
        callSite: {
          filePath: innerCall.filePath,
          start: innerCall.start,
          end: innerCall.end,
          text: innerCall.text,
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

  it("preserves every credible declaration target", () => {
    const caller = createNode({ id: "caller", name: "caller" });
    const call = createCallExpressionNode({ id: "call" });
    const firstDeclaration = createNode({ id: "first-declaration", name: "first" });
    const secondDeclaration = createNode({ id: "second-declaration", name: "second" });
    const graph: FlowGraph = {
      nodes: [caller, call, firstDeclaration, secondDeclaration],
      edges: [
        createEdge(caller.id, call.id, 'calls'),
        createEdge(call.id, firstDeclaration.id, 'references'),
        createEdge(call.id, secondDeclaration.id, 'references'),
      ],
    };

    const result = toFlowGraph(graph);

    assert.deepEqual(
      result.edges.map((edge) => edge.target),
      [firstDeclaration.id, secondDeclaration.id],
    );
  });
});
