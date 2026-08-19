import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
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
      sourceOrigin: "project",
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
      sourceOrigin: "project",
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
      sourceOrigin: "project",
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
      sourceOrigin: "project",
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
      sourceOrigin: "project",
      signature,
      declarationFile: normalizePath(sourceFileFixture.fileName),
      declarationTsNode: functionDeclarationFixture,
      tsNode: callExpressionFixture,
    });
  });

  it("marks unresolved call expression nodes with unknown source origin", () => {
    const builder = new NodeModule.NodeBuilder(createTypeChecker());

    assert.equal(builder.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "unknown");
  });

  it("marks call expression nodes with external declarations as external", () => {
    const externalSourceFile = ts.createSourceFile(
      "/typescript/lib/lib.es5.d.ts",
      "interface Array<T> { map<U>(): U[] }",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const externalDeclaration = externalSourceFile.statements[0];
    const signature = {
      declaration: externalDeclaration,
    } as ts.Signature;
    const builder = new NodeModule.NodeBuilder(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(builder.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "external");
  });

  it("marks TypeScript standard library call expression nodes as native JavaScript API", () => {
    const nativeSourceFile = ts.createSourceFile(
      path.join(path.dirname(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ESNext })), "lib.es2019.object.d.ts"),
      "interface ObjectConstructor { fromEntries(): object }",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const nativeDeclaration = nativeSourceFile.statements[0];
    const signature = {
      declaration: nativeDeclaration,
    } as ts.Signature;
    const builder = new NodeModule.NodeBuilder(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(builder.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "native-js-api");
  });

  it("marks Node API call expression nodes as native Node API", () => {
    const nativeSourceFile = ts.createSourceFile(
      "/workspace/node_modules/@types/node/fs.d.ts",
      "export function existsSync(): boolean",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const nativeDeclaration = nativeSourceFile.statements[0];
    const signature = {
      declaration: nativeDeclaration,
    } as ts.Signature;
    const builder = new NodeModule.NodeBuilder(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(builder.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "native-node-api");
  });
});
