import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, describe, it } from 'node:test';
import type { ExtensionContext, TextDocument, TextEditor } from 'vscode';
import { ok } from 'neverthrow';
import { commands, Uri, window, workspace } from '@mocks/vscode.js';
import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('../mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { activate, deactivate } = await import('./index.js');
const { FlowLensGraphWebview } = await import('@infrastructure/webview.js');
hooks.deregister();

const extensionContext = {
  subscriptions: [],
  extensionUri: Uri.file('/extension'),
  secrets: {},
} as unknown as ExtensionContext;

afterEach(async () => {
  await deactivate();
  window.activeTextEditor = undefined;
  workspace.textDocuments = [];

  for (const subscription of extensionContext.subscriptions.splice(0)) {
    subscription.dispose();
  }
});

describe('activate', () => {
  it('rejects duplicate activation before registering commands or replacing the service', async t => {
    const registerCommand = t.mock.method(commands, 'registerCommand');
    const dispose = t.mock.method(WorkspaceAnalysisService.prototype, 'dispose');
    activate(extensionContext);
    const registrationCount = registerCommand.mock.callCount();

    assert.ok(registrationCount > 0);
    assert.throws(() => activate(extensionContext), /already active or shutting down/);
    assert.equal(registerCommand.mock.callCount(), registrationCount);
    await deactivate();
    assert.equal(dispose.mock.callCount(), 1);
  });
});

describe('deactivate', () => {
  it('suppresses pending command results after shutdown', async t => {
    const document = {
      uri: { scheme: 'file', fsPath: '/project/entry.ts' }, languageId: 'typescript', isDirty: false, offsetAt: () => 17,
    } as unknown as TextDocument;
    window.activeTextEditor = { document, selection: { active: {} } } as TextEditor;
    const registration = t.mock.method(commands, 'registerCommand');
    const show = t.mock.method(FlowLensGraphWebview.prototype, 'showGraph', async () => {});
    const pending = Promise.withResolvers<Awaited<ReturnType<WorkspaceAnalysisService['analyze']>>>();
    t.mock.method(WorkspaceAnalysisService.prototype, 'analyze', () => pending.promise);
    activate(extensionContext);
    const command = registration.mock.calls.find(call => call.arguments[0] === 'flowlens.generateGraph')!.arguments[1];
    const generating = command();

    await deactivate();
    pending.resolve(ok({ nodes: [], edges: [] }));
    await generating;
    assert.equal(show.mock.callCount(), 0);
  });

  it('blocks activation during cleanup and allows a fresh service after shutdown', async t => {
    const cleanup = Promise.withResolvers<void>();
    const dispose = t.mock.method(WorkspaceAnalysisService.prototype, 'dispose', () => cleanup.promise);
    activate(extensionContext);
    const firstShutdown = deactivate();
    const repeatedShutdown = deactivate();
    const firstService = dispose.mock.calls[0]!.this;

    assert.throws(() => activate(extensionContext), /already active or shutting down/);
    cleanup.resolve();
    await Promise.all([firstShutdown, repeatedShutdown]);
    activate(extensionContext);
    await deactivate();
    assert.notEqual(dispose.mock.calls[2]!.this, firstService);
  });

  it('reports cleanup failure and keeps the activation guard in place', async t => {
    const cleanupError = new Error('cleanup failed');
    const dispose = t.mock.method(WorkspaceAnalysisService.prototype, 'dispose', async () => { throw cleanupError; });
    activate(extensionContext);

    await assert.rejects(deactivate(), error => error === cleanupError);
    assert.throws(() => activate(extensionContext), /already active or shutting down/);
    dispose.mock.restore();
  });
});
