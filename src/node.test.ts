import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import * as NodeModule from './node.js';
import { normalizePath } from './utils.js';
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
  variableStatementNodeFixture,
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

describe("isFileNode", () => {
  it("identifies file nodes", () => {
    assert.equal(NodeModule.isFileNode(createFileNode()), true);
    assert.equal(NodeModule.isFileNode(createNode({ kind: "if-statement" })), false);
  });
});

describe("createFileId", () => {
  it("uses the normalized source file path", () => {
    assert.equal(NodeModule.createFileId(sourceFileFixture), normalizePath(sourceFileFixture.fileName));
  });
});

describe("deriveIdFromTsNode", () => {
  it("combines the source file path and text span", () => {
    assert.equal(
      NodeModule.deriveIdFromTsNode(functionDeclarationFixture),
      `${sourceFileFixture.fileName}:${functionDeclarationFixture.pos}:${functionDeclarationFixture.end}`,
    );
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
      id: NodeModule.deriveIdFromTsNode(functionDeclarationFixture),
      name: "fixtureFunction",
      filePath: normalizePath(sourceFileFixture.fileName),
      kind: "functionDeclaration",
      signature,
      jsdoc: "Fixture docs",
      tsNode: functionDeclarationFixture,
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
      id: NodeModule.deriveIdFromTsNode(callExpressionFixture),
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

describe("isNodeProcessable", () => {
  it("returns true for source files, executable functions, and call expressions", () => {
    assert.equal(NodeModule.isNodeProcessable(sourceFileFixture), true);
    assert.equal(NodeModule.isNodeProcessable(functionDeclarationFixture), true);
    assert.equal(NodeModule.isNodeProcessable(arrowFunctionFixture), true);
    assert.equal(NodeModule.isNodeProcessable(callExpressionFixture), true);
  });

  it("returns false for non-executable syntax nodes", () => {
    assert.equal(NodeModule.isNodeProcessable(variableStatementNodeFixture), false);
  });
});
