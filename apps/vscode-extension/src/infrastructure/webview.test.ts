import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { registerHooks } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFunctionDeclarationNode, createFileNode } from '@flowlens/analyzer-core/fixtures/node';
import { createVsCodeEvent, isFlowGraphEvent } from '@flowlens/registries/vscode-events';
import { panels, Uri, commands } from '@mocks/vscode.js';
import type { SetAiApiKeyResult } from '@infrastructure/ai-key-commands.js';
import { err, ok } from 'neverthrow';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('../mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { FlowLensGraphWebview } = await import('./webview.js');
hooks.deregister();
const directory = await mkdtemp(join(tmpdir(), 'flowlens-webview-'));
await mkdir(join(directory, 'media/frontend'), { recursive: true });
await writeFile(join(directory, 'media/frontend/index.html'), '<html><head></head></html>');
after(() => rm(directory, { recursive: true, force: true }));

const node = createFunctionDeclarationNode();
const file = createFileNode();
const graph = { nodes: [node, file], edges: [] };
const explanation = { purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] };

describe('FlowLensGraphWebview', () => {
  it('routes recovery requests through existing commands and returns only configuration outcomes', async context => {
    const { panel } = await setup();
    const calls: string[] = [];
    let outcome = 'saved';
    context.mock.method(commands, 'executeCommand', async (id: string) => {
      calls.push(id);
      if (outcome === 'throws') throw new Error('secret-key');
      return outcome === 'failed' ? err({ reason: 'configuration-failed', cause: new Error('secret-key') }) : ok(outcome);
    });

    for (const expected of ['saved', 'cancelled', 'failed'] as const) {
      outcome = expected;
      await panel.receive(createVsCodeEvent('ai.configure', { requestId: expected }));
      assert.deepEqual(panel.messages.at(-1), createVsCodeEvent('ai.configure.result', {
        requestId: expected, outcome: expected,
      }));
    }

    outcome = 'throws';
    await panel.receive(createVsCodeEvent('ai.configure', { requestId: 'failure' }));
    assert.deepEqual(panel.messages.at(-1), createVsCodeEvent('ai.configure.result', {
      requestId: 'failure', outcome: 'failed',
    }));
    outcome = 'saved';
    await panel.receive(createVsCodeEvent('graph.generate', {}));
    assert.deepEqual(calls, [...Array(4).fill('flowlens.setAiApiKey'), 'flowlens.generateGraph']);
    await panel.receive({ type: 'ai.configure', payload: { requestId: 'bad', apiKey: 'secret-key' } });
    assert.equal(calls.length, 5);
    assert.equal(JSON.stringify(panel.messages).includes('secret-key'), false);
  });

  it('does not deliver configuration completion to a disposed panel', async context => {
    const { host, panel } = await setup();
    const deferred = Promise.withResolvers<SetAiApiKeyResult>();
    context.mock.method(commands, 'executeCommand', () => deferred.promise);
    const count = panel.messages.length;
    const delivery = panel.receive(createVsCodeEvent('ai.configure', { requestId: 'pending' }));
    panel.dispose();
    await host.showGraph(graph);
    deferred.resolve(ok('saved'));
    await delivery;
    assert.equal(panel.messages.length, count);
    assert.deepEqual(panels.at(-1)!.messages, []);
  });

  it('reuses one panel, preserves IDs on resend, and replaces graph generations', async () => {
    const { host, panel, session } = await setup();
    const count = panels.length;
    await panel.receive(createVsCodeEvent('view.ready', {}));
    assert.deepEqual(panel.messages.at(-1), createVsCodeEvent('flowgraph', session));
    await host.showGraph(graph);
    assert.equal(panels.length, count);
    const replacement = panel.messages.at(-1);
    assert.ok(isFlowGraphEvent(replacement));
    assert.notEqual(replacement.payload.graphId, session.graphId);
  });

  it('uses the captured function and original request IDs across graph replacement', async () => {
    const deferred = Promise.withResolvers<typeof explanation>();
    const { host, panel, session } = await setup(async received => {
      assert.equal(received, node);
      return ok(await deferred.promise);
    });
    const request = { graphId: session.graphId, nodeId: node.id, requestId: 'request' };
    const delivery = panel.receive(createVsCodeEvent('explain.node', request));
    await host.showGraph(graph);
    deferred.resolve(explanation);
    await delivery;
    assert.deepEqual(panel.messages.at(-1), createVsCodeEvent('explain.node.result', { ...request, explanation }));
  });

  it('ignores invalid requests and suppresses replies after closure and reopening', async () => {
    const deferred = Promise.withResolvers<typeof explanation>();
    const { host, panel, session } = await setup(async () => ok(await deferred.promise));
    const count = panel.messages.length;
    await panel.receive({ type: 'explain.node', payload: {} });
    assert.equal(panel.messages.length, count);
    const request = createVsCodeEvent('explain.node', { graphId: session.graphId, nodeId: node.id, requestId: 'request' });
    const delivery = panel.receive(request);
    panel.dispose();
    await host.showGraph(graph);
    const replacement = panels.at(-1)!;
    assert.notEqual(replacement, panel);
    deferred.resolve(explanation);
    await delivery;
    await panel.receive(request);
    assert.equal(panel.messages.length, count);
    assert.deepEqual(replacement.messages, []);
  });
});

async function setup(explain?: NonNullable<ConstructorParameters<typeof FlowLensGraphWebview>[1]>['explainFunction']) {
  const host = new FlowLensGraphWebview(Uri.file(directory) as import('vscode').Uri, explain ? { explainFunction: explain } : {});
  await host.showGraph(graph);
  const panel = panels.at(-1)!;
  await panel.receive(createVsCodeEvent('view.ready', {}));
  const message = panel.messages.at(-1);
  assert.ok(isFlowGraphEvent(message));
  return { host, panel, session: message.payload };
}
