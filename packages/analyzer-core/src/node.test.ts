import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import * as NodeModule from './node.js';
import { normalizePath } from '@flowlens/common';
import { assertErr, assertOk } from '@flowlens/common/testing';
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

describe("findNodeAtPosition", () => {
  it("returns the deepest node containing a position inside a function body", () => {
    const sourceText = `
      function run() {
        const value = dependency();
        return value;
      }
    `;
    const sourceFile = ts.createSourceFile("fixture.ts", sourceText, ts.ScriptTarget.Latest, true);
    const position = sourceText.lastIndexOf("value");

    const result = NodeModule.findNodeAtPosition(sourceFile, position);

    assertOk(result);

    assert.equal(ts.isIdentifier(result.value), true);
    assert.equal(result.value.getText(sourceFile), "value");
  });

  it("returns not-found for a position outside the source file range", () => {
    const sourceFile = ts.createSourceFile(
      "fixture.ts",
      "function run() { return 1; }",
      ts.ScriptTarget.Latest,
      true,
    );

    const result = NodeModule.findNodeAtPosition(sourceFile, sourceFile.getEnd());

    assertErr(result);
    assert.equal(result.error, "not-found");
  });
});

describe("findEnclosingFunction", () => {
  it("finds a function declaration enclosing a node", () => {
    const sourceText = `
      function run() {
        const value = 1;
        return value;
      }
    `;
    const sourceFile = ts.createSourceFile("fixture.ts", sourceText, ts.ScriptTarget.Latest, true);
    const nodeResult = NodeModule.findNodeAtPosition(sourceFile, sourceText.lastIndexOf("value"));

    assertOk(nodeResult);

    const result = NodeModule.findEnclosingFunction(nodeResult.value);

    assertOk(result);

    if (!ts.isFunctionDeclaration(result.value)) {
      assert.fail("Expected a function declaration.");
    }

    assert.equal(result.value.name?.getText(sourceFile), "run");
  });

  it("finds an arrow function assigned to a const enclosing a node", () => {
    const sourceText = `
      const run = () => {
        const value = 1;
        return value;
      };
    `;
    const sourceFile = ts.createSourceFile("fixture.ts", sourceText, ts.ScriptTarget.Latest, true);
    const nodeResult = NodeModule.findNodeAtPosition(sourceFile, sourceText.lastIndexOf("value"));

    assertOk(nodeResult);

    const result = NodeModule.findEnclosingFunction(nodeResult.value);

    assertOk(result);

    if (!ts.isArrowFunction(result.value)) {
      assert.fail("Expected an arrow function.");
    }
  });

  it("finds a class method enclosing a node", () => {
    const sourceText = `
      class Service {
        run() {
          const value = 1;
          return value;
        }
      }
    `;
    const sourceFile = ts.createSourceFile("fixture.ts", sourceText, ts.ScriptTarget.Latest, true);
    const nodeResult = NodeModule.findNodeAtPosition(sourceFile, sourceText.lastIndexOf("value"));

    assertOk(nodeResult);

    const result = NodeModule.findEnclosingFunction(nodeResult.value);

    assertOk(result);

    if (!ts.isMethodDeclaration(result.value)) {
      assert.fail("Expected a method declaration.");
    }

    assert.equal(result.value.name.getText(sourceFile), "run");
  });

  it("returns not-found when no executable function encloses a node", () => {
    const sourceText = "const value = 1;";
    const sourceFile = ts.createSourceFile("fixture.ts", sourceText, ts.ScriptTarget.Latest, true);
    const nodeResult = NodeModule.findNodeAtPosition(sourceFile, sourceText.indexOf("value"));

    assertOk(nodeResult);

    const result = NodeModule.findEnclosingFunction(nodeResult.value);

    assertErr(result);
    assert.equal(result.error, "not-found");
  });
});

describe("toGraphNode", () => {
  it("maps analyzer nodes to JSON-safe graph nodes", () => {
    const graphNode = NodeModule.toGraphNode(createCallExpressionNode());

    assert.deepEqual(graphNode, {
      id: "fixture.ts:33:45",
      kind: "callExpression",
      name: "dependency",
      filePath: "fixture.ts",
    });
    assert.equal(Object.hasOwn(graphNode, "tsNode"), false);
    assert.equal(Object.hasOwn(graphNode, "signature"), false);
    assert.equal(Object.hasOwn(graphNode, "declarationTsNode"), false);
    assert.equal(Object.hasOwn(graphNode, "declarationFile"), false);
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

  it("builds arrow function nodes from their variable declaration name", () => {
    const builder = new NodeModule.NodeBuilder(createTypeChecker());

    assert.deepEqual(builder.buildFunctionDeclarationNode(arrowFunctionFixture), {
      id: NodeModule.deriveIdFromTsNode(arrowFunctionFixture),
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
