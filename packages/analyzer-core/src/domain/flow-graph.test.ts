import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';

import { findNodeInGraphById, isEmpty, isFlowGraph } from './flow-graph.js';
import { create as createEdge } from '../fixtures/edge.js';
import { createCallExpressionNode, createFunctionDeclarationNode, createCallableTypeMemberDeclarationNode, createUnresolvedCallDeclarationNode } from '../fixtures/node.js';

describe("isFlowGraph", () => {
  it("returns true for objects with node and edge arrays", () => {
    const graph = {
      nodes: [
        createCallExpressionNode(),
        createCallExpressionNode({
          id: "native-js-api",
          sourceOrigin: "native-js-api",
        }),
        createCallExpressionNode({
          id: "native-node-api",
          sourceOrigin: "native-node-api",
        }),
      ],
      edges: [createEdge()],
    };

    assert.equal(isFlowGraph(graph), true);
  });

  it("returns true for non-call nodes without call-site fields", () => {
    const graph = {
      nodes: [
        {
          id: "fixture.ts:1:49",
          kind: "functionDeclaration",
          name: "fixtureFunction",
          filePath: "fixture.ts",
          fileName: "fixture.ts",
          sourceOrigin: "project",
          jsdoc: "Fixture docs",
        },
      ],
      edges: [],
    };

    assert.equal(isFlowGraph(graph), true);
  });

  it("returns true for serialized callable type member declaration nodes", () => {
    assert.equal(isFlowGraph({
      nodes: [createCallableTypeMemberDeclarationNode({ jsdoc: "Type docs" })],
      edges: [],
    }), true);
  });

  it("returns true for serialized unresolved call declaration nodes", () => {
    assert.equal(isFlowGraph({
      nodes: [createUnresolvedCallDeclarationNode()],
      edges: [],
    }), true);
  });

  it("returns false for nodes without a file name", () => {
    const node = createFunctionDeclarationNode();
    const { fileName: _fileName, ...nodeWithoutFileName } = node;

    assert.equal(isFlowGraph({ nodes: [nodeWithoutFileName], edges: [] }), false);
  });

  it("returns false for unresolved call declaration nodes without source positions", () => {
    const node = createUnresolvedCallDeclarationNode();
    const { start: _start, ...nodeWithoutStart } = node;

    assert.equal(isFlowGraph({ nodes: [nodeWithoutStart], edges: [] }), false);
  });

  it("returns false for invalid serialized subtype fields", () => {
    const invalidDeclarationFileGraph = {
      nodes: [
        createCallExpressionNode({ declarationFile: 42 as unknown as string }),
      ],
      edges: [],
    };
    const invalidJsdocGraph = {
      nodes: [
        createFunctionDeclarationNode({ jsdoc: 42 as unknown as string }),
      ],
      edges: [],
    };

    assert.equal(isFlowGraph(invalidDeclarationFileGraph), false);
    assert.equal(isFlowGraph(invalidJsdocGraph), false);
  });

  it("returns false for call expression nodes without call-site fields", () => {
    const graph = {
      nodes: [
        {
          id: "fixture.ts:33:45",
          kind: "callExpression",
          name: "dependency",
          filePath: "fixture.ts",
          fileName: "fixture.ts",
          sourceOrigin: "project",
        },
      ],
      edges: [],
    };

    assert.equal(isFlowGraph(graph), false);
  });

  it("returns true for edges with call expression metadata", () => {
    const graph = {
      nodes: [createCallExpressionNode()],
      edges: [
        createEdge({
          metadata: {
            kind: "call-expression",
            callSite: {
              filePath: "src/source.ts",
              start: 12,
              end: 24,
              text: "dependency()",
            },
          },
        }),
      ],
    };

    assert.equal(isFlowGraph(graph), true);
  });

  it("returns false for values without node and edge arrays", () => {
    assert.equal(isFlowGraph(undefined), false);
    assert.equal(isFlowGraph(null), false);
    assert.equal(isFlowGraph({ nodes: [], edges: undefined }), false);
    assert.equal(isFlowGraph({ nodes: {}, edges: [] }), false);
    assert.equal(isFlowGraph({ nodes: [], links: [] }), false);
  });

  it("returns false for invalid call expression metadata", () => {
    const graph = {
      nodes: [createCallExpressionNode()],
      edges: [
        {
          id: "source-node->target-node:calls:call-expression:src/source.ts:12:24",
          source: "source-node",
          target: "target-node",
          type: "calls",
          metadata: {
            kind: "call-expression",
            callSite: {
              filePath: "src/source.ts",
              start: 12,
              end: 24,
              tsNode: {},
            },
          },
        },
      ],
    };

    assert.equal(isFlowGraph(graph), false);
  });
});

describe("isEmpty", () => {
  it("returns whether the graph has no nodes", () => {
    assert.equal(isEmpty({ nodes: [], edges: [] }), true);
    assert.equal(isEmpty({ nodes: [createCallExpressionNode()], edges: [] }), false);
  });
});

describe("findNodeInGraphById", () => {
  it("returns the matching node or undefined", () => {
    const node = createFunctionDeclarationNode();
    const graph = { nodes: [node], edges: [] };

    assert.equal(findNodeInGraphById(graph, node.id), node);
    assert.equal(findNodeInGraphById(graph, "missing"), undefined);
  });
});

