import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import { createCallExpressionNode, createFunctionDeclarationNode, createSerializedNode } from '../fixtures/node.js';
import { toProjectSourceGraph } from './index.js';

describe("toProjectSourceGraph", () => {
  it("removes non-project source nodes and keeps project and unknown nodes", () => {
    const source = createFunctionDeclarationNode({
      id: "source",
      name: "source",
      sourceOrigin: "project",
      jsdoc: "Source docs",
    });
    const external = createCallExpressionNode({
      id: "external",
      name: "values.map",
      sourceOrigin: "external",
    });
    const nativeJsApi = createCallExpressionNode({
      id: "native-js-api",
      name: "Object.fromEntries",
      sourceOrigin: "native-js-api",
    });
    const nativeNodeApi = createCallExpressionNode({
      id: "native-node-api",
      name: "fs.existsSync",
      sourceOrigin: "native-node-api",
    });
    const unknown = createCallExpressionNode({
      id: "unknown",
      name: "unresolved",
      sourceOrigin: "unknown",
      declarationFile: "src/dependency.ts",
    });
    const graph: FlowGraph = {
      nodes: [source, external, nativeJsApi, nativeNodeApi, unknown],
      edges: [
        createEdge(source.id, external.id, 'calls'),
        createEdge(external.id, nativeJsApi.id, 'calls'),
        createEdge(nativeJsApi.id, nativeNodeApi.id, 'calls'),
        createEdge(nativeNodeApi.id, unknown.id, 'calls'),
      ],
    };

    const result = toProjectSourceGraph(graph);

    assert.deepEqual(result.nodes, [source, unknown]);
    assert.deepEqual(result.edges, [
      createEdge(source.id, unknown.id, 'calls'),
    ]);
  });

  it("supports serialized graph nodes without requiring analyzer node fields", () => {
    const source = createSerializedNode({ id: "source", name: "source", sourceOrigin: "project" });
    const external = createSerializedNode({ id: "external", name: "external", sourceOrigin: "external" });
    const nativeJsApi = createSerializedNode({
      id: "native-js-api",
      name: "native-js-api",
      sourceOrigin: "native-js-api",
    });
    const nativeNodeApi = createSerializedNode({
      id: "native-node-api",
      name: "native-node-api",
      sourceOrigin: "native-node-api",
    });
    const unknown = createSerializedNode({ id: "unknown", name: "unknown", sourceOrigin: "unknown" });
    const graph: FlowGraph = {
      nodes: [source, external, nativeJsApi, nativeNodeApi, unknown],
      edges: [
        createEdge(source.id, external.id, 'calls'),
        createEdge(external.id, nativeJsApi.id, 'calls'),
        createEdge(nativeJsApi.id, nativeNodeApi.id, 'calls'),
        createEdge(nativeNodeApi.id, unknown.id, 'calls'),
      ],
    };

    const result = toProjectSourceGraph(graph);

    assert.deepEqual(result.nodes, [source, unknown]);
    assert.equal('tsNode' in result.nodes[0]!, false);
    assert.deepEqual(result.edges, [
      createEdge(source.id, unknown.id, 'calls'),
    ]);
  });
});
