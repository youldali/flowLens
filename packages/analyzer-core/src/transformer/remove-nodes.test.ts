import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { create as createEdge } from '../edge.js';
import type { FlowGraph } from '../flow-graph.js';
import { createCallExpressionEdgeMetadata } from '../fixtures/edge.js';
import { createFunctionDeclarationNode, createNode as createNodeFixture } from '../fixtures/node.js';
import type { Node } from '../node.js';
import type { BridgeEdgeContext } from './remove-nodes.js';
import { removeNodes } from './remove-nodes.js';

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

  it("bridges one removed node to every kept outgoing target", () => {
    const source = createNode("source");
    const removed = createNode("removed");
    const targetA = createNode("target-a");
    const targetB = createNode("target-b");
    const graph = createGraph({
      nodes: [source, removed, targetA, targetB],
      edges: [
        createEdge(source.id, removed.id, 'calls'),
        createEdge(removed.id, targetA.id, 'references'),
        createEdge(removed.id, targetB.id, 'declares'),
      ],
    });

    const result = removeNodes((node) => node.id === removed.id)(graph);

    assert.deepEqual(result.nodes, [source, targetA, targetB]);
    assert.deepEqual(result.edges, [
      createEdge(source.id, targetA.id, 'calls'),
      createEdge(source.id, targetB.id, 'calls'),
    ]);
  });

  it("bridges through branching chains of removed nodes", () => {
    const source = createNode("source");
    const removedA = createNode("removed-a");
    const removedB = createNode("removed-b");
    const removedC = createNode("removed-c");
    const targetA = createNode("target-a");
    const targetB = createNode("target-b");
    const graph = createGraph({
      nodes: [source, removedA, removedB, removedC, targetA, targetB],
      edges: [
        createEdge(source.id, removedA.id, 'calls'),
        createEdge(removedA.id, removedB.id, 'references'),
        createEdge(removedA.id, removedC.id, 'references'),
        createEdge(removedB.id, targetA.id, 'declares'),
        createEdge(removedC.id, targetB.id, 'declares'),
      ],
    });

    const result = removeNodes((node) => node.id.startsWith("removed"))(graph);

    assert.deepEqual(result.nodes, [source, targetA, targetB]);
    assert.deepEqual(result.edges, [
      createEdge(source.id, targetA.id, 'calls'),
      createEdge(source.id, targetB.id, 'calls'),
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

  it("uses a custom bridge edge factory when provided", () => {
    const source = createNode("source");
    const removed = createNode("removed");
    const target = createNode("target");
    const metadata = createCallExpressionEdgeMetadata();
    const graph = createGraph({
      nodes: [source, removed, target],
      edges: [
        createEdge(source.id, removed.id, 'calls'),
        createEdge(removed.id, target.id, 'references'),
      ],
    });

    const result = removeNodes(
      (node) => node.id === removed.id,
      {
        createBridgeEdge: ({ incomingEdge, outgoingEdge }) => createEdge(
          incomingEdge.source,
          outgoingEdge.target,
          incomingEdge.type,
          metadata,
        ),
      },
    )(graph);

    assert.deepEqual(result.edges, [
      createEdge(source.id, target.id, 'calls', metadata),
    ]);
  });

  it("provides the removed nodes at both boundaries of a bridge", () => {
    const source = createNode("source");
    const entryRemovedNode = createNode("entry-removed");
    const exitRemovedNode = createNode("exit-removed");
    const target = createNode("target");
    const incomingEdge = createEdge(source.id, entryRemovedNode.id, 'calls');
    const removedChainEdge = createEdge(entryRemovedNode.id, exitRemovedNode.id, 'references');
    const outgoingEdge = createEdge(exitRemovedNode.id, target.id, 'declares');
    const graph = createGraph({
      nodes: [source, entryRemovedNode, exitRemovedNode, target],
      edges: [
        incomingEdge,
        removedChainEdge,
        outgoingEdge,
      ],
    });
    const bridgeContexts: BridgeEdgeContext[] = [];

    removeNodes(
      (node) => node.id.endsWith("removed"),
      {
        createBridgeEdge: (context) => {
          bridgeContexts.push(context);
          return createEdge(context.incomingEdge.source, context.outgoingEdge.target, 'calls');
        },
      },
    )(graph);

    assert.deepEqual(bridgeContexts, [{
      incomingEdge,
      outgoingEdge,
      entryRemovedNode,
      exitRemovedNode,
    }]);
  });

  it("supports serialized graph nodes without requiring analyzer node fields", () => {
    const source = createNodeFixture({ id: "source", name: "source" });
    const removed = createNodeFixture({ id: "removed", name: "removed" });
    const target = createNodeFixture({ id: "target", name: "target" });
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

function createNode(id: string): Node {
  return createFunctionDeclarationNode({
    id,
    name: id,
  });
}

function createGraph(graph: FlowGraph): FlowGraph {
  return graph;
}
