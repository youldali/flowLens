import legacyTs from 'typescript';
import { RepositoryAnalysisContext } from '../infrastructure/repository-analysis-context.js';
import { findWorkspaceRoot } from '@flowlens/common/fs';
import { after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { before, describe, it } from 'node:test';
import * as ts from '../fixtures/native-compiler.js';

import { create as createEdge } from '../fixtures/edge.js';
import { createCallExpressionNode } from '../fixtures/node.js';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { deriveIdFromTsNode, isExecutableFunction } from './ts-node/index.js';
import { isCallableTypeMemberDeclarationNode, isFunctionDeclarationNode, isCallExpressionNode } from '../domain/node.js';
import { collapseResolvedCallExpressionNodes } from '../domain/transformer/collapse-resolved-call-expression-nodes.js';
import { createSyntheticNodesForCallExpressionsWithoutDeclarations } from '../domain/transformer/index.js';

import { GraphAdapter } from './graph-adapter.js';

const tsconfigPath = path.resolve("tsconfig.json");
const entryFilePath = path.resolve("src/fixtures/graph-builder-entry.ts");

const context = new RepositoryAnalysisContext(findWorkspaceRoot(tsconfigPath));
const createGraphAdapter = async (): Promise<GraphAdapter> => await GraphAdapter.create(tsconfigPath, context);

const createClosureNamingTestContext = async () => {
  const sourceText = fs.readFileSync(entryFilePath, "utf8");
  const sourceFile = ts.createSourceFile(entryFilePath, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = sourceFile.statements.find((node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "closureNamingFlow");
  assert.ok(declaration);

  const functions: ts.Node[] = [];
  const collectExecutableFunctions = (node: ts.Node): void => {
    if (isExecutableFunction(node)) functions.push(node);
    ts.forEachChild(node, collectExecutableFunctions);
  };
  collectExecutableFunctions(declaration);

  const functionIds = functions.map(deriveIdFromTsNode);
  const fullGraphAdapter = await createGraphAdapter();
  const focusedGraphAdapter = await createGraphAdapter();
  assertOk(await fullGraphAdapter.fromFile(entryFilePath));
  assertOk(await focusedGraphAdapter.fromFilePosition(entryFilePath, declaration.getStart()));

  const fullGraph = fullGraphAdapter.extract();

  return {
    functions,
    functionIds,
    fullGraph,
    focusedGraph: focusedGraphAdapter.extract(),
    fullFunctionNodes: functionIds.map((id) => fullGraph.nodes.find((node) => node.id === id)),
  };
};

describe("GraphAdapter.extract implementations", () => {
  it("includes class methods and object literal properties in callable type members", async () => {
    const adapter = await createGraphAdapter();
    const filePath = path.resolve("src/fixtures/implementation-entry.ts");
    assertOk(await adapter.fromFile(filePath));
    const members = adapter.extract().nodes.filter(isCallableTypeMemberDeclarationNode);

    const run = members.find((node) => node.name === "run");
    const handle = members.find((node) => node.name === "handle");
    const absent = members.find((node) => node.name === "absent");
    assert.ok(run?.kind === "callableTypeMemberDeclaration");
    assert.ok(handle?.kind === "callableTypeMemberDeclaration");
    assert.ok(absent?.kind === "callableTypeMemberDeclaration");
    assert.deepEqual(run.implementations.map((entry) => entry.name), ["run"]);
    assert.deepEqual(handle.implementations.map((entry) => entry.name), ["handle"]);
    assert.deepEqual(absent.implementations, []);

    for (const entry of [...run.implementations, ...handle.implementations]) {
      assert.equal(entry.filePath, filePath);
      assert.ok(entry.line > 0);
      assert.ok(entry.column > 0);
      assert.equal(fs.readFileSync(entry.filePath, "utf8").slice(entry.offset, entry.offset + entry.name.length), entry.name);
    }
  });

  it("deduplicates eager results and skips locations without navigable source", async () => {
    const adapter = await createGraphAdapter();
    const filePath = path.resolve("src/fixtures/implementation-entry.ts");
    const source = fs.readFileSync(filePath, "utf8");
    const offset = source.indexOf("run(): number", source.indexOf("class ClassRunner"));
    const location: legacyTs.ImplementationLocation = {
      fileName: filePath,
      textSpan: { start: offset, length: 3 },
      kind: legacyTs.ScriptElementKind.memberFunctionElement,
      displayParts: [],
    };
    const languageService = context.legacyRegistry.getService(tsconfigPath).languageService;
    languageService.getImplementationAtPosition = () => [
      location,
      location,
      { ...location, fileName: path.resolve("src/fixtures/missing.ts") },
    ];

    assertOk(await adapter.fromFile(filePath));
    const run = adapter.extract().nodes.filter(isCallableTypeMemberDeclarationNode)
      .find((node) => node.name === "run");
    assert.ok(run?.kind === "callableTypeMemberDeclaration");
    assert.deepEqual(run.implementations.map((entry) => entry.name), ["run"]);
    const sourceResult = adapter.getNavigableSource(filePath);
    assertOk(sourceResult);
    assert.equal(sourceResult.value, source);

    const missingSourceResult = adapter.getNavigableSource(path.resolve("src/fixtures/missing.ts"));
    assertErr(missingSourceResult);
    assert.deepEqual(missingSourceResult.error, { reason: 'source-file-not-found' });
  });
});

describe("GraphAdapter.extract", () => {
  it("returns serialized domain nodes without TypeScript objects", async () => {
    const node = createCallExpressionNode();
    const edge = createEdge({
      id: "fixture.ts:33:45->fixture.ts:1:49:references",
      source: "fixture.ts:33:45",
      target: "fixture.ts:1:49",
      type: "references",
    });
    const graphAdapter = Object.assign(Object.create(GraphAdapter.prototype), {
      nodes: new Map([[node.id, node]]),
      edges: new Map([[edge.id, edge]]),
    }) as GraphAdapter;

    const graph = graphAdapter.extract();

    assert.deepEqual(graph, {
      nodes: [node],
      edges: [edge],
    });
    assert.equal('tsNode' in graph.nodes[0]!, false);
    assert.equal('declarationTsNode' in graph.nodes[0]!, false);
    assert.equal('signature' in graph.nodes[0]!, false);
  });
});

describe("GraphAdapter.fromFile", () => {
  it("builds a graph from a source file path", async () => {
    const graphAdapter = await createGraphAdapter();

    const result = await graphAdapter.fromFile(entryFilePath);

    assertOk(result);

    const graph = graphAdapter.extract();
    const nodeNames = graph.nodes.map((node) => node.name);
    const tsNodesByNodeId = (
      graphAdapter as unknown as { tsNodesByNodeId: ReadonlyMap<string, ts.Node> }
    ).tsNodesByNodeId;
    const dependencyNode = graph.nodes.find((node) => node.name === "dependency" && node.kind === "callExpression");
    const dependencyTsNode = dependencyNode ? tsNodesByNodeId.get(dependencyNode.id) : undefined;

    assert.equal(result.value, undefined);
    assert.equal(nodeNames.includes("graph-builder-entry.ts"), true);
    assert.equal(nodeNames.includes("selectedFlow"), true);
    assert.equal(nodeNames.includes("otherFlow"), true);
    assert.equal(tsNodesByNodeId.size, graph.nodes.length);
    assert.equal(graph.nodes.every((node) => tsNodesByNodeId.has(node.id)), true);
    assert.equal(dependencyTsNode ? ts.isCallExpression(dependencyTsNode) : false, true);
  });

  it("returns source-file-not-found when the source file is outside the program", async () => {
    const graphAdapter = await createGraphAdapter();

    const result = await graphAdapter.fromFile(path.resolve("src/fixtures/missing-entry.ts"));

    assertErr(result);
    assert.deepEqual(result.error, { reason: "source-file-not-found" });
  });
});

describe("GraphAdapter.fromFilePosition", () => {
  describe("anonymous function labels and identity", () => {
    let context: Awaited<ReturnType<typeof createClosureNamingTestContext>>;

    before(async () => {
      context = await createClosureNamingTestContext();
    });

    it("keeps function nodes stable between full and focused graphs", async () => {
      const { focusedGraph, fullFunctionNodes, functionIds } = context;
      const focusedFunctionNodes = functionIds.map((id) =>
        focusedGraph.nodes.find((node) => node.id === id));

      assert.deepEqual(focusedFunctionNodes, fullFunctionNodes);
      assert.deepEqual(fullFunctionNodes.map((node) => node?.displayName), [
        "closureNamingFlow",
        "anonymous at line 58",
        "anonymous at line 58",
        "anonymous at line 58",
        "map callback",
        "anonymous at line 60",
      ]);
    });

    it("keeps focused graph edge identities stable", async () => {
      const { focusedGraph, fullGraph, functionIds } = context;
      const fullEdgeIds = new Set(fullGraph.edges.map((edge) => edge.id));
      const focusedInternalEdges = focusedGraph.edges.filter((edge) => edge.target !== functionIds[0]);

      assert.equal(focusedInternalEdges.every((edge) => fullEdgeIds.has(edge.id)), true);
    });

    it("keeps collapse results stable when display labels are absent", async () => {
      const { focusedGraph } = context;
      const collapsedGraph = collapseResolvedCallExpressionNodes(focusedGraph);
      const legacyGraph = {
        ...focusedGraph,
        nodes: focusedGraph.nodes.map(({ displayName, ...node }) => node),
      };
      const collapsedLegacyGraph = collapseResolvedCallExpressionNodes(legacyGraph);

      assert.deepEqual(collapsedGraph.edges, collapsedLegacyGraph.edges);
      assert.deepEqual(
        collapsedGraph.nodes.map((node) => node.id),
        collapsedLegacyGraph.nodes.map((node) => node.id),
      );
    });

    it("preserves the IIFE label and relationships after collapsing calls", async () => {
      const { focusedGraph, functionIds } = context;
      const collapsedGraph = collapseResolvedCallExpressionNodes(focusedGraph);
      const flowId = functionIds[0];
      const iifeId = functionIds.at(-1);

      assert.ok(collapsedGraph.edges.some((edge) =>
        edge.source === flowId && edge.target === iifeId && edge.type === "calls"));
      assert.ok(collapsedGraph.edges.some((edge) =>
        edge.target === iifeId && edge.type === "declares"));
      assert.equal(
        collapsedGraph.nodes.find((node) => node.id === iifeId)?.displayName,
        "anonymous at line 60",
      );
    });

    it("keeps function identity when entering through the nested IIFE", async () => {
      const { functions, fullFunctionNodes, functionIds } = context;
      const iife = functions.at(-1);
      const iifeId = functionIds.at(-1);
      assert.ok(iife);

      const nestedGraphAdapter = await createGraphAdapter();
      assertOk(await nestedGraphAdapter.fromFilePosition(entryFilePath, iife.getStart()));

      const nestedIife = nestedGraphAdapter.extract().nodes.find((node) => node.id === iifeId);
      assert.deepEqual(nestedIife, fullFunctionNodes.at(-1));
    });
  });

  it("accepts a source file path and builds from the enclosing function", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("value =");

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(nodeNames.includes("selectedFlow"), true);
    assert.equal(nodeNames.includes("dependency"), true);
    assert.equal(nodeNames.includes("otherFlow"), false);
    assert.equal(
      graph.edges.some((edge) => edge.type === "declares" && edge.target.includes("graph-builder-entry.ts")),
      true,
    );
  });

  it("accepts a SourceFile and resolves the program source file by path", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const sourceFile = ts.createSourceFile(
      entryFilePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const position = sourceText.indexOf("value =");

    const result = await graphAdapter.fromFilePosition(sourceFile, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(nodeNames.includes("selectedFlow"), true);
    assert.equal(nodeNames.includes("otherFlow"), false);
  });

  it("builds from the enclosing class method", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("return value;", sourceText.indexOf("class FlowService"));

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(nodeNames.includes("run"), true);
    assert.equal(nodeNames.includes("dependency"), true);
    assert.equal(nodeNames.includes("selectedFlow"), false);
  });

  it("resolves type-alias properties and interface method signatures as declarations", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("flowContract.property");

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const callableTypeMemberDeclarations = graph.nodes.filter(
      (node) => node.kind === "callableTypeMemberDeclaration",
    );
    const interfaceCalls = graph.nodes.filter(
      (node) => node.kind === "callExpression" && node.name.startsWith("flowContract."),
    );

    assert.deepEqual(
      callableTypeMemberDeclarations.map((node) => node.name).sort(),
      ["method", "property"],
    );
    assert.deepEqual(interfaceCalls.map((node) => node.name).sort(), [
      "flowContract.method",
      "flowContract.property",
    ]);
    assert.equal(
      interfaceCalls.every((call) => graph.edges.some(
        (edge) => edge.source === call.id
          && edge.type === "references"
          && callableTypeMemberDeclarations.some((declaration) => declaration.id === edge.target),
      )),
      true,
    );
    assert.equal(
      callableTypeMemberDeclarations.every((declaration) => graph.edges.some(
        (edge) => edge.target === declaration.id && edge.type === "declares",
      )),
      true,
    );
    assert.equal(
      createSyntheticNodesForCallExpressionsWithoutDeclarations(graph).nodes.some(
        (node) => node.kind === "unresolved-call-declaration",
      ),
      false,
    );
  });

  it("marks native JavaScript call expressions while preserving internal calls", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("values.map");

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const mapCallNode = graph.nodes.find((node) => node.name === "values.map");
    const dependencyCallNode = graph.nodes.find((node) => node.name === "dependency");

    assert.equal(mapCallNode?.sourceOrigin, "native-js-api");
    assert.equal(dependencyCallNode?.sourceOrigin, "project");
  });

  it("marks Object.fromEntries as native JavaScript API", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("Object.fromEntries");

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const fromEntriesCallNode = graph.nodes.find((node) => node.name === "Object.fromEntries");

    assert.equal(fromEntriesCallNode?.sourceOrigin, "native-js-api");
  });

  it("marks Node call expressions as native Node API", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("fs.existsSync");

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const existsSyncCallNode = graph.nodes.find((node) => node.name === "fs.existsSync");

    assert.equal(existsSyncCallNode?.sourceOrigin, "native-node-api");
  });

  it("returns source-file-not-found when the SourceFile is outside the program", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceFile = ts.createSourceFile(
      path.resolve("src/fixtures/missing-entry.ts"),
      "function missing() {}",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const result = await graphAdapter.fromFilePosition(sourceFile, 0);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "source-file-not-found" });
  });

  it("returns node-not-found for a position outside the source file range", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");

    const result = await graphAdapter.fromFilePosition(entryFilePath, sourceText.length);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "node-not-found" });
  });

  it("returns enclosing-function-not-found when the position is outside a function", async () => {
    const graphAdapter = await createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("topLevelValue");

    const result = await graphAdapter.fromFilePosition(entryFilePath, position);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "enclosing-function-not-found" });
  });
});

describe('GraphAdapter native semantic resolution', () => {
  it('resolves imports, aliases, arrows, methods and nested functions to exact declarations', async () => {
    const root = path.resolve('src/fixtures/native-resolution');
    const entry = path.join(root, 'entry.ts');
    const adapter = await GraphAdapter.create(path.join(root, 'tsconfig.json'), context);
    assertOk(await adapter.fromFile(entry));
    const graph = adapter.extract();
    const calls = graph.nodes.filter(isCallExpressionNode);
    const targetFor = (name: string) => {
      const call = calls.find(node => node.name === name);
      assert.ok(call, name);
      const reference = graph.edges.find(edge => edge.source === call.id && edge.type === 'references');
      assert.ok(reference, name);
      const target = graph.nodes.find(node => node.id === reference.target);
      assert.ok(target && isFunctionDeclarationNode(target), name);
      assert.equal(fs.readFileSync(target.filePath, 'utf8').slice(target.start, target.end), target.sourceText);
      return target;
    };
    const imported = targetFor('aliased');
    assert.equal(imported.name, 'validateInvoice');
    assert.equal(imported.filePath, path.join(root, 'dependency.ts'));
    assert.equal(imported.jsdoc, 'Validates an invoice.');
    assert.equal(imported.start, fs.readFileSync(imported.filePath, 'utf8').indexOf('export function validateInvoice'));
    assert.equal(targetFor('reexported').id, imported.id);
    assert.equal(targetFor('defaultFunction').sourceText, 'export default function defaultFunction() { return true; }');
    assert.equal(targetFor('aliasedOverload').sourceText, 'export function overloaded(value: string | number) { return value; }');
    assert.equal(targetFor('validateArrow').sourceText, '() => true');
    assert.equal(targetFor('new Validator().validate').sourceText, 'validate() { return true; }');
    assert.equal(targetFor('expression').name, 'namedExpression');
    assert.equal(targetFor('nested').name, 'nested');
    const nested = targetFor('nested');
    const nestedCall = calls.find(node => node.name === 'local' && node.start >= nested.start && node.end <= nested.end);
    assert.ok(nestedCall);
    assert.ok(graph.edges.some(edge => edge.source === nested.id && edge.target === nestedCall.id && edge.type === 'calls'));
    const unresolved = calls.find(node => node.name === 'missing');
    assert.ok(unresolved);
    assert.equal(unresolved.sourceOrigin, 'unknown');
    assert.ok(!graph.edges.some(edge => edge.source === unresolved.id && edge.type === 'references'));
    assert.doesNotThrow(() => JSON.stringify(graph));
  });
});

after(() => context.clear());
