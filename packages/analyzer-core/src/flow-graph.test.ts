import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';

import { GraphBuilder, isFlowGraph } from './flow-graph.js';
import { create as createEdge } from './fixtures/edge.js';
import { createCallExpressionNode } from './fixtures/node.js';
import { assertErr, assertOk } from '@flowlens/common/testing';

const tsconfigPath = path.resolve("tsconfig.json");
const entryFilePath = path.resolve("src/fixtures/graph-builder-entry.ts");

const createGraphBuilder = (): GraphBuilder => new GraphBuilder(tsconfigPath);

describe("isFlowGraph", () => {
  it("returns true for objects with node and edge arrays", () => {
    const graph = {
      nodes: [createCallExpressionNode()],
      edges: [createEdge()],
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
});

describe("GraphBuilder.extract", () => {
  it("returns a JSON-safe graph without analyzer-only node fields", () => {
    const node = createCallExpressionNode();
    const edge = createEdge({
      id: "fixture.ts:33:45->fixture.ts:1:49:references",
      source: "fixture.ts:33:45",
      target: "fixture.ts:1:49",
      type: "references",
    });
    const graphBuilder = Object.assign(Object.create(GraphBuilder.prototype), {
      nodes: new Map([[node.id, node]]),
      edges: new Map([[edge.id, edge]]),
    }) as GraphBuilder;

    assert.deepEqual(graphBuilder.extract(), {
      nodes: [
        {
          id: "fixture.ts:33:45",
          kind: "callExpression",
          name: "dependency",
          filePath: "fixture.ts",
        },
      ],
      edges: [edge],
    });
  });
});

describe("GraphBuilder.fromFile", () => {
  it("builds a graph from a source file path", () => {
    const graphBuilder = createGraphBuilder();

    const result = graphBuilder.fromFile(entryFilePath);

    assertOk(result);

    const graph = graphBuilder.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(result.value, undefined);
    assert.equal(nodeNames.includes("graph-builder-entry.ts"), true);
    assert.equal(nodeNames.includes("selectedFlow"), true);
    assert.equal(nodeNames.includes("otherFlow"), true);
  });

  it("returns source-file-not-found when the source file is outside the program", () => {
    const graphBuilder = createGraphBuilder();

    const result = graphBuilder.fromFile(path.resolve("src/fixtures/missing-entry.ts"));

    assertErr(result);
    assert.deepEqual(result.error, { reason: "source-file-not-found" });
  });
});

describe("GraphBuilder.fromFilePosition", () => {
  it("accepts a source file path and builds from the enclosing function", () => {
    const graphBuilder = createGraphBuilder();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("value =");

    const result = graphBuilder.fromFilePosition(entryFilePath, position);

    assertOk(result);

    const graph = graphBuilder.extract();
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
    const graphBuilder = createGraphBuilder();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const sourceFile = ts.createSourceFile(
      entryFilePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const position = sourceText.indexOf("value =");

    const result = graphBuilder.fromFilePosition(sourceFile, position);

    assertOk(result);

    const graph = graphBuilder.extract();
    const nodeNames = graph.nodes.map((node) => node.name);

    assert.equal(nodeNames.includes("selectedFlow"), true);
    assert.equal(nodeNames.includes("otherFlow"), false);
  });

  it("returns source-file-not-found when the SourceFile is outside the program", () => {
    const graphBuilder = createGraphBuilder();
    const sourceFile = ts.createSourceFile(
      path.resolve("src/fixtures/missing-entry.ts"),
      "function missing() {}",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const result = graphBuilder.fromFilePosition(sourceFile, 0);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "source-file-not-found" });
  });

  it("returns node-not-found for a position outside the source file range", () => {
    const graphBuilder = createGraphBuilder();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");

    const result = graphBuilder.fromFilePosition(entryFilePath, sourceText.length);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "node-not-found" });
  });

  it("returns enclosing-function-not-found when the position is outside a function", () => {
    const graphBuilder = createGraphBuilder();
    const sourceText = fs.readFileSync(entryFilePath, "utf8");
    const position = sourceText.indexOf("topLevelValue");

    const result = graphBuilder.fromFilePosition(entryFilePath, position);

    assertErr(result);
    assert.deepEqual(result.error, { reason: "enclosing-function-not-found" });
  });
});
