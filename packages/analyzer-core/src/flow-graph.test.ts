import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';

import { GraphAdapter, isFlowGraph } from './flow-graph.js';
import { create as createEdge } from './fixtures/edge.js';
import { createCallExpressionNode, createFunctionDeclarationNode } from './fixtures/node.js';
import { assertErr, assertOk } from '@flowlens/common/testing';

const tsconfigPath = path.resolve("tsconfig.json");
const entryFilePath = path.resolve("src/fixtures/graph-builder-entry.ts");

const createGraphAdapter = (): GraphAdapter => new GraphAdapter(tsconfigPath);

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
          sourceOrigin: "project",
          jsdoc: "Fixture docs",
        },
      ],
      edges: [],
    };

    assert.equal(isFlowGraph(graph), true);
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

describe("GraphAdapter.extract", () => {
  it("returns serialized domain nodes without TypeScript objects", () => {
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
  it("builds a graph from a source file path", () => {
    const graphAdapter = createGraphAdapter();

    const result = graphAdapter.fromFile(entryFilePath);

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

  it("returns source-file-not-found when the source file is outside the program", () => {
    const graphAdapter = createGraphAdapter();

    const result = graphAdapter.fromFile(path.resolve("src/fixtures/missing-entry.ts"));

    assertErr(result);
    assert.deepEqual(result.error, { reason: "source-file-not-found" });
  });
});

describe("GraphAdapter.fromFilePosition", () => {
  it("accepts a source file path and builds from the enclosing function", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("value =");

    const result = graphAdapter.fromFilePosition(entryFilePath, position);

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

  it("accepts a SourceFile and resolves the program source file by path", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const sourceFile = ts.createSourceFile(
      entryFilePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const position = sourceText.indexOf("value =");

    const result = graphAdapter.fromFilePosition(sourceFile, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(nodeNames.includes("selectedFlow"), true);
    assert.equal(nodeNames.includes("otherFlow"), false);
  });

  it("builds from the enclosing class method", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("return value;", sourceText.indexOf("class FlowService"));

    const result = graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(nodeNames.includes("run"), true);
    assert.equal(nodeNames.includes("dependency"), true);
    assert.equal(nodeNames.includes("selectedFlow"), false);
  });

  it("marks native JavaScript call expressions while preserving internal calls", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("values.map");

    const result = graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const mapCallNode = graph.nodes.find((node) => node.name === "values.map");
    const dependencyCallNode = graph.nodes.find((node) => node.name === "dependency");

    assert.equal(mapCallNode?.sourceOrigin, "native-js-api");
    assert.equal(dependencyCallNode?.sourceOrigin, "project");
  });

  it("marks Object.fromEntries as native JavaScript API", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("Object.fromEntries");

    const result = graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const fromEntriesCallNode = graph.nodes.find((node) => node.name === "Object.fromEntries");

    assert.equal(fromEntriesCallNode?.sourceOrigin, "native-js-api");
  });

  it("marks Node call expressions as native Node API", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("fs.existsSync");

    const result = graphAdapter.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphAdapter.extract();
    const existsSyncCallNode = graph.nodes.find((node) => node.name === "fs.existsSync");

    assert.equal(existsSyncCallNode?.sourceOrigin, "native-node-api");
  });

  it("returns source-file-not-found when the SourceFile is outside the program", () => {
    const graphAdapter = createGraphAdapter();
    const sourceFile = ts.createSourceFile(
      path.resolve("src/fixtures/missing-entry.ts"),
      "function missing() {}",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const result = graphAdapter.fromFilePosition(sourceFile, 0);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "source-file-not-found" });
  });

  it("returns node-not-found for a position outside the source file range", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");

    const result = graphAdapter.fromFilePosition(entryFilePath, sourceText.length);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "node-not-found" });
  });

  it("returns enclosing-function-not-found when the position is outside a function", () => {
    const graphAdapter = createGraphAdapter();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("topLevelValue");

    const result = graphAdapter.fromFilePosition(entryFilePath, position);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "enclosing-function-not-found" });
  });
});
