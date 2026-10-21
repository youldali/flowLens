import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createVsCodeEvent } from '@flowlens/registries/vscode-events';
import { createFunctionDeclarationNode, createFileNode } from '@flowlens/analyzer-core/fixtures/node';
import { createGraphSession } from './graph-session.js';

const node = createFunctionDeclarationNode();
const graph = { nodes: [node, createFileNode()], edges: [] };

describe('createGraphSession', () => {
  it('retains the graph and assigns a fresh ID per generation', () => {
    const session = createGraphSession(graph);
    assert.equal(session.graph, graph);
    const firstDelivery = createVsCodeEvent('flowgraph', session);
    const resend = createVsCodeEvent('flowgraph', session);
    assert.equal(firstDelivery.payload.graphId, resend.payload.graphId);
    assert.notEqual(session.graphId, createGraphSession(graph).graphId);
  });
});

