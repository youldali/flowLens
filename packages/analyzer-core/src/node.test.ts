import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import * as NodeModule from './node.js';
import * as TsNodeModule from './tsNode.js';
import { normalizePath } from '@flowlens/common';
import { create as createEdge } from './edge.js';
import type { FlowGraph } from './flow-graph.js';
import { createProgram } from './mocks/program.js';
import { createTypeChecker } from './mocks/typechecker.js';
import {
  create as createNode,
  createCallExpressionNode,
  createFileNode,
  createFunctionDeclarationNode,
  createCallableTypeMemberDeclarationNode,
  createUnresolvedCallDeclarationNode,
} from './fixtures/node.js';
import {
  arrowFunctionFixture,
  callExpressionFixture,
  functionDeclarationFixture,
  methodSignatureFixture,
  propertySignatureFixture,
  sourceFileFixture,
} from './fixtures/ts-node.js';

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

describe("NodeAdapter", () => {
  it("builds file nodes from source files", () => {
    const adapter = new NodeModule.NodeAdapter(createTypeChecker());

    assert.deepEqual(adapter.buildFileNode(sourceFileFixture), {
      id: normalizePath(sourceFileFixture.fileName),
      name: "fixture.ts",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "file",
      sourceOrigin: "project",
    });
  });

  it("builds function declaration nodes with jsdoc data", () => {
    const symbol = {
      getDocumentationComment: () => [{ text: "Fixture docs", kind: "text" }],
    } as unknown as ts.Symbol;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getSymbolAtLocation: (node) => {
        assert.equal(node, functionDeclarationFixture);
        return symbol;
      },
    }));

    assert.deepEqual(adapter.buildFunctionDeclarationNode(functionDeclarationFixture), {
      id: TsNodeModule.deriveIdFromTsNode(functionDeclarationFixture),
      name: "fixtureFunction",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "functionDeclaration",
      sourceOrigin: "project",
      jsdoc: "Fixture docs",
    });
  });

  it("builds arrow function nodes from their variable declaration name", () => {
    const adapter = new NodeModule.NodeAdapter(createTypeChecker());

    assert.deepEqual(adapter.buildFunctionDeclarationNode(arrowFunctionFixture), {
      id: TsNodeModule.deriveIdFromTsNode(arrowFunctionFixture),
      name: "arrowFixture",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "functionDeclaration",
      sourceOrigin: "project",
    });
  });

  it("builds callable type member declaration nodes with jsdoc data", () => {
    const symbol = {
      getDocumentationComment: () => [{ text: "Interface docs", kind: "text" }],
    } as unknown as ts.Symbol;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getSymbolAtLocation: (node) => {
        assert.equal(node, propertySignatureFixture.name);
        return symbol;
      },
    }));

    if (!TsNodeModule.isTypeCallableDeclaration(propertySignatureFixture)) {
      assert.fail("Expected a callable type declaration.");
    }

    assert.deepEqual(adapter.buildCallableTypeMemberDeclarationNode(propertySignatureFixture), {
      id: TsNodeModule.deriveIdFromTsNode(propertySignatureFixture),
      name: "property",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "callableTypeMemberDeclaration",
      sourceOrigin: "project",
      jsdoc: "Interface docs",
    });
  });

  it("builds call expression nodes with resolved declaration data", () => {
    const signature = {
      declaration: functionDeclarationFixture,
    } as ts.Signature;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: (node) => {
        assert.equal(node, callExpressionFixture);
        return signature;
      },
    }));

    assert.deepEqual(adapter.buildCallExpressionNode(callExpressionFixture), {
      id: TsNodeModule.deriveIdFromTsNode(callExpressionFixture),
      name: "dependency",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "callExpression",
      sourceOrigin: "project",
      start: callExpressionFixture.pos,
      end: callExpressionFixture.end,
      text: callExpressionFixture.getText(sourceFileFixture),
      declarationFile: normalizePath(sourceFileFixture.fileName),
    });
    assert.equal(adapter.findDeclarationForCallExpression(callExpressionFixture), functionDeclarationFixture);
  });

  it("resolves a function-valued interface property when no executable declaration exists", () => {
    const signature = {
      declaration: propertySignatureFixture.type,
    } as ts.Signature;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(adapter.findDeclarationForCallExpression(callExpressionFixture), propertySignatureFixture);
  });

  it("resolves an interface method signature when no executable declaration exists", () => {
    const signature = {
      declaration: methodSignatureFixture,
    } as ts.Signature;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(adapter.findDeclarationForCallExpression(callExpressionFixture), methodSignatureFixture);
  });

  it("prefers an executable declaration over an interface declaration", () => {
    const interfaceSymbol = {
      getDeclarations: () => [propertySignatureFixture],
    } as unknown as ts.Symbol;
    const signature = {
      declaration: functionDeclarationFixture,
    } as ts.Signature;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
      getSymbolAtLocation: () => interfaceSymbol,
    }));

    assert.equal(adapter.findDeclarationForCallExpression(callExpressionFixture), functionDeclarationFixture);
  });

  it("resolves callable members declared by object type aliases", () => {
    const typeLiteralSourceFile = ts.createSourceFile(
      "type-literal.ts",
      "type Service = { property: () => void }",
      ts.ScriptTarget.Latest,
      true,
    );
    const typeAlias = typeLiteralSourceFile.statements[0];

    if (!typeAlias || !ts.isTypeAliasDeclaration(typeAlias) || !ts.isTypeLiteralNode(typeAlias.type)) {
      assert.fail("Expected a type literal declaration.");
    }

    const property = typeAlias.type.members[0];
    if (!property || !ts.isPropertySignature(property)) {
      assert.fail("Expected a property signature.");
    }

    const signature = { declaration: property.type } as ts.Signature;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(adapter.findDeclarationForCallExpression(callExpressionFixture), property);
  });

  it("does not resolve non-callable interface properties", () => {
    const interfaceSourceFile = ts.createSourceFile(
      "interface.ts",
      "interface Service { count: number }",
      ts.ScriptTarget.Latest,
      true,
    );
    const declaration = interfaceSourceFile.statements[0];

    if (!declaration || !ts.isInterfaceDeclaration(declaration)) {
      assert.fail("Expected an interface declaration.");
    }

    const property = declaration.members[0];
    if (!property || !ts.isPropertySignature(property)) {
      assert.fail("Expected a property signature.");
    }

    const signature = { declaration: property } as unknown as ts.Signature;
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(adapter.findDeclarationForCallExpression(callExpressionFixture), undefined);
  });

  it("marks unresolved call expression nodes with unknown source origin", () => {
    const adapter = new NodeModule.NodeAdapter(createTypeChecker());

    assert.equal(adapter.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "unknown");
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
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(adapter.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "external");
  });

  it("marks TypeScript standard library call expression nodes as native JavaScript API", () => {
    const nativeSourceFile = ts.createSourceFile(
      "/packaged-extension/node_modules/typescript/lib/lib.es2019.object.d.ts",
      "interface ObjectConstructor { fromEntries(): object }",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const nativeDeclaration = nativeSourceFile.statements[0];
    const signature = {
      declaration: nativeDeclaration,
    } as ts.Signature;
    const program = createProgram({
      isSourceFileDefaultLibrary: (sourceFile: ts.SourceFile) => sourceFile === nativeSourceFile,
    });
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }), process.cwd(), program);

    assert.equal(adapter.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "native-js-api");
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
    const adapter = new NodeModule.NodeAdapter(createTypeChecker({
      getResolvedSignature: () => signature,
    }));

    assert.equal(adapter.buildCallExpressionNode(callExpressionFixture).sourceOrigin, "native-node-api");
  });
});
