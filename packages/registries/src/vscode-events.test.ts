import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertErr, assertOk } from '@flowlens/common/testing';

import {
  createVsCodeEvent,
  isFlowGraphEvent,
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
