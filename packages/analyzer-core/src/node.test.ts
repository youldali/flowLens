import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import * as NodeModule from './node.js';
import * as TsNodeModule from './tsNode.js';
import { normalizePath } from '@flowlens/common';
import { createTypeChecker } from './mocks/typechecker.js';
import {
  create as createNode,
  createCallExpressionNode,
  createFileNode,
  createFunctionDeclarationNode,
} from './fixtures/node.js';
import {
  arrowFunctionFixture,
  callExpressionFixture,
  functionDeclarationFixture,
  sourceFileFixture,
} from './fixtures/ts-node.js';

describe("isFunctionDeclarationNode", () => {
  it("identifies function and method declaration nodes", () => {
    assert.equal(NodeModule.isFunctionDeclarationNode(createFunctionDeclarationNode()), true);
    assert.equal(NodeModule.isFunctionDeclarationNode(createFunctionDeclarationNode({ kind: "methodDeclaration" })), true);
    assert.equal(NodeModule.isFunctionDeclarationNode(createCallExpressionNode()), false);
  });
});

describe("isCallExpressionNode", () => {
  it("identifies call expression nodes", () => {
    assert.equal(NodeModule.isCallExpressionNode(createCallExpressionNode()), true);
    assert.equal(NodeModule.isCallExpressionNode(createFileNode()), false);
  });
});

describe("hasCallExpressionDeclaration", () => {
  it("identifies call expression nodes with resolved declarations", () => {
    assert.equal(NodeModule.hasCallExpressionDeclaration(createCallExpressionNode()), true);
    assert.equal(NodeModule.hasCallExpressionDeclaration(createCallExpressionNode({ declarationTsNode: undefined })), false);
  });
});

describe("isFileNode", () => {
  it("identifies file nodes", () => {
    assert.equal(NodeModule.isFileNode(createFileNode()), true);
    assert.equal(NodeModule.isFileNode(createNode({ kind: "if-statement" })), false);
  });
});

describe("toSerializedGraphNode", () => {
  it("maps analyzer nodes to JSON-safe graph nodes", () => {
    const serializedGraphNode = NodeModule.toSerializedGraphNode(createCallExpressionNode());

    assert.deepEqual(serializedGraphNode, {
      id: "fixture.ts:33:45",
      kind: "callExpression",
      name: "dependency",
      filePath: "fixture.ts",
    });
    assert.equal(Object.hasOwn(serializedGraphNode, "tsNode"), false);
    assert.equal(Object.hasOwn(serializedGraphNode, "signature"), false);
    assert.equal(Object.hasOwn(serializedGraphNode, "declarationTsNode"), false);
    assert.equal(Object.hasOwn(serializedGraphNode, "declarationFile"), false);
  });
});

describe("NodeBuilder", () => {
  it("builds file nodes from source files", () => {
    const builder = new NodeModule.NodeBuilder(createTypeChecker());

    assert.deepEqual(builder.buildFileNode(sourceFileFixture), {
      id: normalizePath(sourceFileFixture.fileName),
      name: "fixture.ts",
      filePath: normalizePath(sourceFileFixture.fileName),
      kind: "file",
      tsNode: sourceFileFixture,
    });
  });

  it("builds function declaration nodes with signature and jsdoc data", () => {
    const signature = {} as ts.Signature;
    const type = {} as ts.Type;
    const symbol = {
      getDocumentationComment: () => [{ text: "Fixture docs", kind: "text" }],
    } as unknown as ts.Symbol;
    const builder = new NodeModule.NodeBuilder(createTypeChecker({
      getSignaturesOfType: (actualType) => {
        assert.equal(actualType, type);
        return [signature];
      },
      getSymbolAtLocation: (node) => {
        assert.equal(node, functionDeclarationFixture);
        return symbol;
      },
      getTypeOfSymbolAtLocation: (actualSymbol, node) => {
        assert.equal(actualSymbol, symbol);
        assert.equal(node, functionDeclarationFixture);
        return type;
      },
    }));

    assert.deepEqual(builder.buildFunctionDeclarationNode(functionDeclarationFixture), {
      id: TsNodeModule.deriveIdFromTsNode(functionDeclarationFixture),
      name: "fixtureFunction",
      filePath: normalizePath(sourceFileFixture.fileName),
      kind: "functionDeclaration",
      signature,
      jsdoc: "Fixture docs",
      tsNode: functionDeclarationFixture,
    });
  });

  it("builds arrow function nodes from their variable declaration name", () => {
    const builder = new NodeModule.NodeBuilder(createTypeChecker());

    assert.deepEqual(builder.buildFunctionDeclarationNode(arrowFunctionFixture), {
      id: TsNodeModule.deriveIdFromTsNode(arrowFunctionFixture),
      name: "arrowFixture",
      filePath: normalizePath(sourceFileFixture.fileName),
      kind: "functionDeclaration",
      signature: undefined,
      tsNode: arrowFunctionFixture,
    });
  });

  it("builds call expression nodes with resolved declaration data", () => {
    const signature = {
      declaration: functionDeclarationFixture,
    } as ts.Signature;
    const builder = new NodeModule.NodeBuilder(createTypeChecker({
      getResolvedSignature: (node) => {
        assert.equal(node, callExpressionFixture);
        return signature;
      },
    }));

    assert.deepEqual(builder.buildCallExpressionNode(callExpressionFixture), {
      id: TsNodeModule.deriveIdFromTsNode(callExpressionFixture),
      name: "dependency",
      filePath: normalizePath(sourceFileFixture.fileName),
      kind: "callExpression",
      signature,
      declarationFile: normalizePath(sourceFileFixture.fileName),
      declarationTsNode: functionDeclarationFixture,
      tsNode: callExpressionFixture,
    });
  });
});
