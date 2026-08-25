import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { AnalyzerGraph, FlowGraph } from '../flow-graph.js';
import { createFunctionDeclarationNode, createSerializedNode } from '../fixtures/node.js';
import type { AnalyzerNode } from '../node.js';
import { removeNodes } from './index.js';

describe("removeNodes", () => {
  it("removes one node and bridges kept neighbors with the upstream edge type", () => {
    const source = createNode("source");
    const removed = createNode("removed");
    const target = createNode("target");
    const graph = createGraph({
      nodes: [source, removed, target],
      edges: [
        createEdge(source.id, removed.id, 'calls'),
        createEdge(removed.id, target.id, 'references'),
      ],
    });

    const result = removeNodes((node) => node.id === removed.id)(graph);

    assert.deepEqual(result.nodes, [source, target]);
    assert.deepEqual(result.edges, [
      createEdge(source.id, target.id, 'calls'),
    ]);
  });

  it("bridges through chains of removed nodes", () => {
    const source = createNode("source");
    const removedA = createNode("removed-a");
    const removedB = createNode("removed-b");
    const target = createNode("target");
    const graph = createGraph({
      nodes: [source, removedA, removedB, target],
      edges: [
        createEdge(source.id, removedA.id, 'calls'),
        createEdge(removedA.id, removedB.id, 'references'),
        createEdge(removedB.id, target.id, 'declares'),
      ],
    });

    const result = removeNodes((node) => node.id.startsWith("removed"))(graph);

    assert.deepEqual(result.nodes, [source, target]);
    assert.deepEqual(result.edges, [
      createEdge(source.id, target.id, 'calls'),
    ]);
  });

  it("preserves existing edges between kept nodes", () => {
    const source = createNode("source");
    const target = createNode("target");
    const removed = createNode("removed");
    const keptEdge = createEdge(source.id, target.id, 'references');
    const graph = createGraph({
      nodes: [source, target, removed],
      edges: [
        keptEdge,
        createEdge(source.id, removed.id, 'calls'),
      ],
    });

    const result = removeNodes((node) => node.id === removed.id)(graph);

    assert.deepEqual(result.nodes, [source, target]);
    assert.deepEqual(result.edges, [keptEdge]);
  });

  it("deduplicates bridged edges", () => {
    const source = createNode("source");
    const removed = createNode("removed");
    const target = createNode("target");
    const duplicateEdge = createEdge(source.id, removed.id, 'calls');
    const graph = createGraph({
      nodes: [source, removed, target],
      edges: [
        duplicateEdge,
        duplicateEdge,
        createEdge(removed.id, target.id, 'references'),
      ],
    });

    const result = removeNodes((node) => node.id === removed.id)(graph);

    assert.deepEqual(result.edges, [
      createEdge(source.id, target.id, 'calls'),
    ]);
  });

  it("supports serialized graph nodes without requiring analyzer node fields", () => {
    const source = createSerializedNode({ id: "source", name: "source" });
    const removed = createSerializedNode({ id: "removed", name: "removed" });
    const target = createSerializedNode({ id: "target", name: "target" });
    const graph: FlowGraph = {
      nodes: [source, removed, target],
      edges: [
        createEdge(source.id, removed.id, 'calls'),
        createEdge(removed.id, target.id, 'references'),
      ],
    };

    const result = removeNodes((node) => node.id === removed.id)(graph);

    assert.deepEqual(result.nodes, [source, target]);
    assert.equal('tsNode' in result.nodes[0]!, false);
    assert.deepEqual(result.edges, [
      createEdge(source.id, target.id, 'calls'),
    ]);
  });
});

function createNode(id: string): AnalyzerNode {
  return createFunctionDeclarationNode({
    id,
    name: id,
  });
}

function createGraph(graph: AnalyzerGraph): AnalyzerGraph {
  return graph;
}
