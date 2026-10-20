import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertErr, assertOk } from '@flowlens/common/testing';

import {
  createVsCodeEvent,
  isFlowGraphEvent,
  isOpenSourceEvent,
  isViewReadyEvent,
  parseVsCodeEvent,
} from './vscode-events.js';
import { createFlowGraphEvent } from './fixtures/vscode-event.js';

const flowGraphEvent = createFlowGraphEvent();

describe('createVsCodeEvent', () => {
  it('creates an event with the registry payload shape', () => {
    assert.deepEqual(createVsCodeEvent('view.ready', {}), {
      type: 'view.ready',
      payload: {},
    });
  });
});

describe('parseVsCodeEvent', () => {
  it('accepts all generator error reasons unchanged', () => {
    const ids = { graphId: 'graph', nodeId: 'node', requestId: 'request' };

    for (const reason of ['api-error', 'invalid-output', 'missing-api-token', 'generation-failed'] as const) {
      const message = createVsCodeEvent('explain.node.error', { ...ids, reason });
      const result = parseVsCodeEvent(JSON.parse(JSON.stringify(message)), message.type);

      assertOk(result);
      assert.deepEqual(result.value, message);
    }
  });

  it('returns the parsed event for a known type and valid payload', () => {
    const result = parseVsCodeEvent(flowGraphEvent, 'flowgraph');

    assertOk(result);
    assert.deepEqual(result.value, flowGraphEvent);
  });

  it('returns event-type-unknown for an unregistered event type', () => {
    const result = parseVsCodeEvent(flowGraphEvent, 'unknown.event');

    assertErr(result);
    assert.deepEqual(result.error, {
      kind: 'event-type-unknown',
      eventType: 'unknown.event',
    });
  });

  it('returns parsing-vscode-event-failed for an invalid event payload', () => {
    const result = parseVsCodeEvent({ type: 'flowgraph', payload: {} }, 'flowgraph');

    assertErr(result);
    assert.deepEqual(result.error, {
      kind: 'parsing-vscode-event-failed',
      eventType: 'flowgraph',
    });
  });
});

describe('isFlowGraphEvent', () => {
  it('identifies flowgraph events', () => {
    assert.equal(isFlowGraphEvent(flowGraphEvent), true);
    assert.equal(isFlowGraphEvent({ type: 'flowgraph', payload: {} }), false);
  });
});

describe('isViewReadyEvent', () => {
  it('identifies view ready events', () => {
    assert.equal(isViewReadyEvent(createVsCodeEvent('view.ready', {})), true);
    assert.equal(isViewReadyEvent(flowGraphEvent), false);
  });
});

describe('isOpenSourceEvent', () => {
  it('identifies valid source navigation events', () => {
    const event = createVsCodeEvent('open.source', {
      filePath: '/project/src/index.ts',
      offset: 42,
    });

    assert.equal(isOpenSourceEvent(event), true);
    assert.equal(isOpenSourceEvent({
      type: 'open.source',
      payload: { filePath: '', offset: -1 },
    }), false);
  });
});

describe('explanation messages', () => {
  it('round-trips requests, results, and errors', () => {
    const ids = { graphId: 'graph', nodeId: 'node', requestId: 'request' };
    const messages = [
      createVsCodeEvent('explain.node', ids),
      createVsCodeEvent('explain.node.result', { ...ids, explanation: {
        purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [],
      } }),
      createVsCodeEvent('explain.node.error', { ...ids, reason: 'stale-graph' }),
    ];

    for (const message of messages) {
      const result = parseVsCodeEvent(JSON.parse(JSON.stringify(message)), message.type);
      assertOk(result);
      assert.deepEqual(result.value, message);
      for (const field of ['graphId', 'nodeId', 'requestId']) {
        assertErr(parseVsCodeEvent({ ...message, payload: { ...message.payload, [field]: '' } }, message.type));
      }
    }
  });

  it('rejects incomplete graphs and invalid explanation payloads', () => {
    const event = createFlowGraphEvent();
    assertErr(parseVsCodeEvent({ ...event, payload: { graph: event.payload.graph } }, 'flowgraph'));
    const ids = { graphId: 'graph', nodeId: 'node', requestId: 'request' };
    assertErr(parseVsCodeEvent({ type: 'explain.node.result', payload: { ...ids, explanation: {} } }, 'explain.node.result'));
    assertErr(parseVsCodeEvent({ type: 'explain.node.error', payload: { ...ids, reason: 'unknown' } }, 'explain.node.error'));
  });
});
