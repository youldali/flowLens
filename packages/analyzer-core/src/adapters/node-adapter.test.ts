import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as ts from '../fixtures/native-compiler.js';

import * as NodeModule from '../domain/node.js';
import * as TsNodeModule from './ts-node/index.js';
import { normalizePath } from '@flowlens/common/fs';
import { createNativeProgram as createProgram } from '../mocks/program.js';
import { createTypeChecker } from '../mocks/typechecker.js';
import { arrowFunctionFixture, callExpressionFixture, functionDeclarationFixture, methodSignatureFixture, propertySignatureFixture, sourceFileFixture } from '../fixtures/ts-node.js';

import { NodeAdapter } from './node-adapter.js';

const createNodeAdapter = (
  checker: ts.TypeChecker = createTypeChecker(),
  program: ts.Program = createProgram(),
): NodeAdapter => {
  return new NodeAdapter(checker, program, { findImplementations: async () => [] });
};

describe("NodeAdapter", () => {
  it("adds semantic labels with native identities", async () => {
    const source = ts.createSourceFile("naming.ts", `
      function parent() {
        retry(() => {});
        [() => {}, () => {}];
        const validate = function actual() {};
      }
    `, ts.ScriptTarget.Latest, true);
    const adapter = createNodeAdapter(createTypeChecker());
    const nodes: NodeModule.FunctionDeclarationNode[] = [];
    const visit = async (node: ts.Node): Promise<void> => {
      if (TsNodeModule.isExecutableFunction(node)) {
        const graphNode = await adapter.buildFunctionDeclarationNode(node);
        assert.equal(graphNode.id, TsNodeModule.deriveIdFromTsNode(node));
        assert.equal(graphNode.name, TsNodeModule.getExecutableFunctionName(node, source));
        nodes.push(graphNode);
      }

      for (const child of node.childrenIter()) {
        await visit(child);
      }

    };
    await visit(source);
    assert.deepEqual(nodes.map(({ name, displayName }) => [name, displayName]), [
      ['parent', 'parent'], ['anonymous', 'retry callback'],
      ['anonymous', 'anonymous at line 4'], ['anonymous', 'anonymous at line 4'],
      ['actual', 'actual'],
    ]);
  });

  it("builds file nodes from source files", async () => {
    const adapter = createNodeAdapter(createTypeChecker());

    assert.deepEqual(await adapter.buildFileNode(sourceFileFixture), {
      id: normalizePath(sourceFileFixture.fileName),
      name: "fixture.ts",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "file",
      sourceOrigin: "project",
    });
  });

  it("builds function declaration nodes with jsdoc data", async () => {
    const symbol = {
      getDocumentationComment: async () => "Fixture docs",
    } as unknown as ts.Symbol;
    const adapter = createNodeAdapter(createTypeChecker({
      getSymbolAtLocation: async (node) => {
        assert.equal(node, functionDeclarationFixture.name);
        return symbol;
      },
    }));

    assert.deepEqual(await adapter.buildFunctionDeclarationNode(functionDeclarationFixture), {
      id: TsNodeModule.deriveIdFromTsNode(functionDeclarationFixture),
      name: "fixtureFunction",
      displayName: "fixtureFunction",
      sourceText: "function fixtureFunction() {\n  return dependency();\n}",
      start: functionDeclarationFixture.getStart(sourceFileFixture),
      end: functionDeclarationFixture.getEnd(),
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "functionDeclaration",
      sourceOrigin: "project",
      jsdoc: "Fixture docs",
    });
  });

  it("builds arrow function nodes from their variable declaration name", async () => {
    const adapter = createNodeAdapter(createTypeChecker());

    assert.deepEqual(await adapter.buildFunctionDeclarationNode(arrowFunctionFixture), {
      id: TsNodeModule.deriveIdFromTsNode(arrowFunctionFixture),
      name: "arrowFixture",
      displayName: "arrowFixture",
      sourceText: "() => dependency()",
      start: arrowFunctionFixture.getStart(sourceFileFixture),
      end: arrowFunctionFixture.getEnd(),
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "functionDeclaration",
      sourceOrigin: "project",
    });
  });

  it('captures exact implementation ranges without leading comments or whitespace', async () => {
    const source = ts.createSourceFile('ranges.ts', `
      /** Function docs */
      async function run() { return 1; }
      class Runner {
        /** Method docs */
        run() { return 2; }
      }
      const callback = () => 3;
    `, ts.ScriptTarget.Latest, true);
    const adapter = createNodeAdapter();
    const implementations: NodeModule.FunctionDeclarationNode[] = [];
    const visit = async (node: ts.Node): Promise<void> => {
      if (TsNodeModule.isExecutableFunction(node)) {
        implementations.push(await adapter.buildFunctionDeclarationNode(node));
      }


      for (const child of node.childrenIter()) {
        await visit(child);
      }

    };

    await visit(source);
    assert.deepEqual(implementations.map(node => source.text.slice(node.start, node.end)), [
      'async function run() { return 1; }',
      'run() { return 2; }',
      '() => 3',
    ]);
    assert.deepEqual(implementations.map(node => source.text.slice(node.start, node.end)), implementations.map(node => node.sourceText));
  });

  it("builds callable type member declaration nodes with jsdoc data", async () => {
    const symbol = {
      getDocumentationComment: async () => "Interface docs",
    } as unknown as ts.Symbol;
    const adapter = createNodeAdapter(createTypeChecker({
      getSymbolAtLocation: async (node) => {
        assert.equal(node, propertySignatureFixture.name);
        return symbol;
      },
    }));

    if (!TsNodeModule.isTypeCallableDeclaration(propertySignatureFixture)) {
      assert.fail("Expected a callable type declaration.");
    }

    assert.deepEqual(await adapter.buildCallableTypeMemberDeclarationNode(propertySignatureFixture), {
      id: TsNodeModule.deriveIdFromTsNode(propertySignatureFixture),
      name: "property",
      filePath: normalizePath(sourceFileFixture.fileName),
      fileName: "fixture.ts",
      kind: "callableTypeMemberDeclaration",
      sourceOrigin: "project",
      implementations: [],
      jsdoc: "Interface docs",
    });
  });

  it("builds call expression nodes with resolved declaration data", async () => {
    const signature = {
      declaration: { resolve: async () => functionDeclarationFixture },
    } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async (node) => {
        assert.equal(node, callExpressionFixture);
        return signature;
      },
    }));

    assert.deepEqual(await adapter.buildCallExpressionNode(callExpressionFixture), {
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
    assert.equal(await adapter.findDeclarationForCallExpression(callExpressionFixture), functionDeclarationFixture);
  });

  it("resolves a function-valued interface property when no executable declaration exists", async () => {
    const signature = {
      declaration: { resolve: async () => propertySignatureFixture.type },
    } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }));

    assert.equal(await adapter.findDeclarationForCallExpression(callExpressionFixture), propertySignatureFixture);
  });

  it("resolves an interface method signature when no executable declaration exists", async () => {
    const signature = {
      declaration: { resolve: async () => methodSignatureFixture },
    } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }));

    assert.equal(await adapter.findDeclarationForCallExpression(callExpressionFixture), methodSignatureFixture);
  });

  it("prefers an executable declaration over an interface declaration", async () => {
    const interfaceSymbol = {
      declarations: [{ resolve: async () => propertySignatureFixture }],
    } as unknown as ts.Symbol;
    const signature = {
      declaration: { resolve: async () => functionDeclarationFixture },
    } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
      getSymbolAtLocation: async () => interfaceSymbol,
    }));

    assert.equal(await adapter.findDeclarationForCallExpression(callExpressionFixture), functionDeclarationFixture);
  });

  it("resolves callable members declared by object type aliases", async () => {
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
    if (!property || !ts.isPropertySignatureDeclaration(property)) {
      assert.fail("Expected a property signature.");
    }

    const signature = { declaration: { resolve: async () => property.type } } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }));

    assert.equal(await adapter.findDeclarationForCallExpression(callExpressionFixture), property);
  });

  it("does not resolve non-callable interface properties", async () => {
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
    if (!property || !ts.isPropertySignatureDeclaration(property)) {
      assert.fail("Expected a property signature.");
    }

    const signature = { declaration: { resolve: async () => property } } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }));

    assert.equal(await adapter.findDeclarationForCallExpression(callExpressionFixture), undefined);
  });

  it("marks unresolved call expression nodes with unknown source origin", async () => {
    const adapter = createNodeAdapter(createTypeChecker());

    assert.equal((await adapter.buildCallExpressionNode(callExpressionFixture)).sourceOrigin, "unknown");
  });

  it("marks call expression nodes with external declarations as external", async () => {
    const externalSourceFile = ts.createSourceFile(
      "/typescript/lib/lib.es5.d.ts",
      "interface Array<T> { map<U>(): U[] }",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const externalDeclaration = externalSourceFile.statements[0];
    const signature = {
      declaration: { resolve: async () => externalDeclaration },
    } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }));

    assert.equal((await adapter.buildCallExpressionNode(callExpressionFixture)).sourceOrigin, "external");
  });

  it("marks TypeScript standard library call expression nodes as native JavaScript API", async () => {
    const nativeSourceFile = ts.createSourceFile(
      "/packaged-extension/node_modules/typescript/lib/lib.es2019.object.d.ts",
      "interface ObjectConstructor { fromEntries(): object }",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const nativeDeclaration = nativeSourceFile.statements[0];
    const signature = {
      declaration: { resolve: async () => nativeDeclaration },
    } as unknown as ts.Signature;
    const program = createProgram({
      isSourceFileDefaultLibrary: async (sourceFile: ts.SourceFile) => sourceFile === nativeSourceFile,
    });
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }), program);

    assert.equal((await adapter.buildCallExpressionNode(callExpressionFixture)).sourceOrigin, "native-js-api");
  });

  it("marks Node API call expression nodes as native Node API", async () => {
    const nativeSourceFile = ts.createSourceFile(
      "/workspace/node_modules/@types/node/fs.d.ts",
      "export function existsSync(): boolean",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const nativeDeclaration = nativeSourceFile.statements[0];
    const signature = {
      declaration: { resolve: async () => nativeDeclaration },
    } as unknown as ts.Signature;
    const adapter = createNodeAdapter(createTypeChecker({
      getResolvedSignature: async () => signature,
    }));

    assert.equal((await adapter.buildCallExpressionNode(callExpressionFixture)).sourceOrigin, "native-node-api");
  });
});
