import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, describe, it } from 'node:test';
import type { ExtensionContext } from 'vscode';
import { commands, Uri } from '@mocks/vscode.js';
import { RepositoryAnalysisService } from '@services/repository-analysis-service.js';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('./mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { activate, deactivate } = await import('./extension.js');
hooks.deregister();

const extensionContext = {
  subscriptions: [],
  extensionUri: Uri.file('/extension'),
  secrets: {},
} as unknown as ExtensionContext;

afterEach(async () => {
  await deactivate();

  for (const subscription of extensionContext.subscriptions.splice(0)) {
    subscription.dispose();
  }
});

describe('activate', () => {
  it('rejects duplicate activation before registering commands or replacing the service', async t => {
    const registerCommand = t.mock.method(commands, 'registerCommand');
    const dispose = t.mock.method(RepositoryAnalysisService.prototype, 'dispose');
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
  it('blocks activation during cleanup and allows a fresh service after shutdown', async t => {
    const cleanup = Promise.withResolvers<void>();
    const dispose = t.mock.method(RepositoryAnalysisService.prototype, 'dispose', () => cleanup.promise);
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
    const dispose = t.mock.method(RepositoryAnalysisService.prototype, 'dispose', async () => { throw cleanupError; });
    activate(extensionContext);

    await assert.rejects(deactivate(), error => error === cleanupError);
    assert.throws(() => activate(extensionContext), /already active or shutting down/);
    dispose.mock.restore();
  });
});
