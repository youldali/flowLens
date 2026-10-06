import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as NodeModule from './node.js';
import { create as createEdge } from './edge.js';
import type { FlowGraph } from './flow-graph.js';
import { create as createNode, createCallExpressionNode, createFileNode, createFunctionDeclarationNode, createCallableTypeMemberDeclarationNode, createUnresolvedCallDeclarationNode } from '../fixtures/node.js';

describe("isFunctionDeclarationNode", () => {
  it("identifies function and method declaration nodes", () => {
    assert.equal(NodeModule.isFunctionDeclarationNode(createFunctionDeclarationNode()), true);
    assert.equal(NodeModule.isFunctionDeclarationNode(createFunctionDeclarationNode({ kind: "methodDeclaration" })), true);
    assert.equal(NodeModule.isFunctionDeclarationNode(createCallExpressionNode()), false);
  });
});

describe("isCallableTypeMemberDeclarationNode", () => {
  it("identifies callable type member declaration nodes", () => {
    assert.equal(
      NodeModule.isCallableTypeMemberDeclarationNode(createCallableTypeMemberDeclarationNode()),
      true,
    );
    assert.equal(
      NodeModule.isCallableTypeMemberDeclarationNode(createFunctionDeclarationNode()),
      false,
    );
  });
});

describe("isCallExpressionNode", () => {
  it("identifies call expression nodes", () => {
    assert.equal(NodeModule.isCallExpressionNode(createCallExpressionNode()), true);
    assert.equal(NodeModule.isCallExpressionNode(createFileNode()), false);
  });
});

describe("isUnresolvedCallDeclarationNode", () => {
  it("identifies unresolved call declaration nodes", () => {
    assert.equal(
      NodeModule.isUnresolvedCallDeclarationNode(createUnresolvedCallDeclarationNode()),
      true,
    );
    assert.equal(NodeModule.isUnresolvedCallDeclarationNode(createCallExpressionNode()), false);
  });
});

describe("hasOutgoingReferenceEdge", () => {
  it("identifies nodes with outgoing reference edges", () => {
    const node = createNode();
    const graph: FlowGraph = {
      nodes: [node],
      edges: [
        createEdge(node.id, "target-node", "references"),
        createEdge(node.id, "called-node", "calls"),
        createEdge("source-node", node.id, "references"),
      ],
    };

    assert.equal(NodeModule.hasOutgoingReferenceEdge(graph, node), true);
    assert.equal(NodeModule.hasOutgoingReferenceEdge({ ...graph, edges: graph.edges.slice(1) }, node), false);
  });
});

describe("isFileNode", () => {
  it("identifies file nodes", () => {
    assert.equal(NodeModule.isFileNode(createFileNode()), true);
    assert.equal(NodeModule.isFileNode(createNode({ kind: "if-statement" })), false);
  });
});

