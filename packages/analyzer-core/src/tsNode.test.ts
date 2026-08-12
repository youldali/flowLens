import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import * as TsNodeModule from './tsNode.js';
import { normalizePath } from '@flowlens/common';
import { assertErr, assertOk } from '@flowlens/common/testing';
import {
  arrowFunctionFixture,
  callExpressionFixture,
  functionDeclarationFixture,
  sourceFileFixture,
  variableStatementNodeFixture,
} from './fixtures/ts-node.js';

describe("createFileId", () => {
  it("uses the normalized source file path", () => {
    assert.equal(TsNodeModule.createFileId(sourceFileFixture), normalizePath(sourceFileFixture.fileName));
  });
});

describe("deriveIdFromTsNode", () => {
  it("combines the source file path and text span", () => {
    assert.equal(
      TsNodeModule.deriveIdFromTsNode(functionDeclarationFixture),
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

    const result = TsNodeModule.findNodeAtPosition(sourceFile, position);

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

    const result = TsNodeModule.findNodeAtPosition(sourceFile, sourceFile.getEnd());

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
    const nodeResult = TsNodeModule.findNodeAtPosition(sourceFile, sourceText.lastIndexOf("value"));

    assertOk(nodeResult);

    const result = TsNodeModule.findEnclosingFunction(nodeResult.value);

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
    const nodeResult = TsNodeModule.findNodeAtPosition(sourceFile, sourceText.lastIndexOf("value"));

    assertOk(nodeResult);

    const result = TsNodeModule.findEnclosingFunction(nodeResult.value);

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
    const nodeResult = TsNodeModule.findNodeAtPosition(sourceFile, sourceText.lastIndexOf("value"));

    assertOk(nodeResult);

    const result = TsNodeModule.findEnclosingFunction(nodeResult.value);

    assertOk(result);

    if (!ts.isMethodDeclaration(result.value)) {
      assert.fail("Expected a method declaration.");
    }

    assert.equal(result.value.name.getText(sourceFile), "run");
  });

  it("returns not-found when no executable function encloses a node", () => {
    const sourceText = "const value = 1;";
    const sourceFile = ts.createSourceFile("fixture.ts", sourceText, ts.ScriptTarget.Latest, true);
    const nodeResult = TsNodeModule.findNodeAtPosition(sourceFile, sourceText.indexOf("value"));

    assertOk(nodeResult);

    const result = TsNodeModule.findEnclosingFunction(nodeResult.value);

    assertErr(result);
    assert.equal(result.error, "not-found");
  });
});

describe("isNodeProcessable", () => {
  it("returns true for source files, executable functions, and call expressions", () => {
    assert.equal(TsNodeModule.isNodeProcessable(sourceFileFixture), true);
    assert.equal(TsNodeModule.isNodeProcessable(functionDeclarationFixture), true);
    assert.equal(TsNodeModule.isNodeProcessable(arrowFunctionFixture), true);
    assert.equal(TsNodeModule.isNodeProcessable(callExpressionFixture), true);
  });

  it("returns false for non-executable syntax nodes", () => {
    assert.equal(TsNodeModule.isNodeProcessable(variableStatementNodeFixture), false);
  });
});
