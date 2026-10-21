import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFunctionDeclarationNode, createFileNode } from '@flowlens/analyzer-core/fixtures/node';
import { createVsCodeEvent } from '@flowlens/registries/vscode-events';
import { GraphController } from './graph-controller.js';
import { err, ok } from 'neverthrow';

const node = createFunctionDeclarationNode();
const file = createFileNode();
const graph = { nodes: [node, file], edges: [] };
const explanation = { purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] };

describe('GraphController', () => {
  it('owns a stable session with a unique ID per instance', () => {
    const controller = new GraphController(graph);
    const replacement = new GraphController(graph);
    const { session } = controller;

    assert.equal(session.graph, graph);
    assert.equal(controller.session, session);
    assert.notEqual(replacement.session.graphId, session.graphId);
  });

  it('explains the requested node and preserves request identifiers', async () => {
    const controller = new GraphController(graph, {
      explainFunction: async received => {
        assert.equal(received, node);
        return ok(explanation);
      },
    });
    const request = { graphId: controller.session.graphId, nodeId: node.id, requestId: 'request' };
    const response = await controller.handleEvent(createVsCodeEvent('explain.node', request));

    assert.deepEqual(response, createVsCodeEvent('explain.node.result', { ...request, explanation }));
  });

  it('returns lookup and explanation errors', async () => {
    const controller = new GraphController(graph);
    const { session } = controller;
    const request = { graphId: session.graphId, nodeId: node.id, requestId: 'request' };
    const cases = [
      [{ ...request, graphId: 'old' }, 'stale-graph'],
      [{ ...request, nodeId: 'missing' }, 'node-not-found'],
      [{ ...request, nodeId: file.id }, 'node-not-explainable'],
      [request, 'missing-api-token'],
    ] as const;

    for (const [payload, reason] of cases) {
      const response = await controller.handleEvent(createVsCodeEvent('explain.node', payload));

      assert.deepEqual(response, createVsCodeEvent('explain.node.error', { ...payload, reason }));
    }

  });

  it('preserves provider error reasons without exposing error details', async () => {
    for (const reason of ['missing-api-token', 'api-error', 'invalid-output', 'generation-failed'] as const) {
      const controller = new GraphController(graph, {
        explainFunction: async () => err({ reason, cause: new Error('secret'), statusCode: 401 }),
      });
      const request = { graphId: controller.session.graphId, nodeId: node.id, requestId: 'request' };
      const response = await controller.handleEvent(createVsCodeEvent('explain.node', request));

      assert.deepEqual(response, createVsCodeEvent('explain.node.error', {
        ...request,
        reason,
      }));
    }
  });

  it('ignores malformed and unrelated events', async () => {
    const controller = new GraphController(graph, {
      explainFunction: async () => {
        assert.fail('Ignored events must not generate explanations');
      },
    });

    for (const message of [null, { type: 'explain.node', payload: {} }, createVsCodeEvent('view.ready', {})]) {
      assert.equal(await controller.handleEvent(message), undefined);
    }
  });
});
