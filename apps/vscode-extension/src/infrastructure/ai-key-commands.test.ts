import { err, ok } from 'neverthrow';
import { assertErr, assertOk } from '@flowlens/common/testing';
import type { SetAiApiKeyResult } from './ai-key-commands.js';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { commands, window, workspace, MockQuickPick } from '@mocks/vscode.js';
import type { AIKeyStoragePort } from '@services/ports/ai-key-storage.js';
import { AiKeyService } from '@services/ai-key-service.js';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('../mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { registerAIKeyCommands, executeSetAiApiKeyCommand } = await import('./ai-key-commands.js');
hooks.deregister();

describe('registerAIKeyCommands', () => {
  it('leaves stored API keys untouched when removing a key with Codex selected', async context => {
    const handlers = new Map<string, () => Promise<unknown>>();
    context.mock.method(commands, 'registerCommand', (id: string, handler: () => Promise<unknown>) => {
      handlers.set(id, handler);
      return { dispose() {} };
    });
    context.mock.method(workspace, 'getConfiguration', () => ({ get: () => 'codex-cli', update: async () => {} }));
    const notice = context.mock.method(window, 'showInformationMessage');
    registerAIKeyCommands(new AiKeyService({
      get: async () => assert.fail('Must not read API keys for Codex'),
      set: async () => assert.fail('Must not write API keys for Codex'),
      delete: async () => assert.fail('Must not delete API keys for Codex'),
    }));

    await handlers.get('flowlens.removeAiApiKey')!();
    assert.match(notice.mock.calls[0]!.arguments[0], /Codex CLI does not use a stored API key/);
  });

  it('registers palette commands and handles set, cancel, replace, remove, and failures safely', async context => {
    const handlers = new Map<string, () => Promise<unknown>>();
    const notices: string[] = [];
    let provider = 'openai';
    let input: string | undefined;
    let confirmation: string | undefined;
    let fail = false;
    const storageFailure = new Error('sensitive-key');
    const values = new Map<string, string>();
    const storage: AIKeyStoragePort = {
      get: async selected => { if (fail) throw new Error('sensitive-key'); return values.get(selected); },
      set: async (selected, key) => { if (fail) throw storageFailure; values.set(selected, key); },
      delete: async selected => { if (fail) throw new Error('sensitive-key'); values.delete(selected); },
    };
    context.mock.method(commands, 'registerCommand', (id: string, handler: () => Promise<unknown>) => {
      handlers.set(id, handler);
      return { dispose() {} };
    });
    context.mock.method(workspace, 'getConfiguration', () => ({ get: () => provider === 'openai' ? 'openai-api' : 'claude-api', update: async () => {} }));
    context.mock.method(window, 'createQuickPick', () => {
      const picker = new MockQuickPick<import('vscode').QuickPickItem>();
      picker.show = () => {
        assert.equal(picker.activeItems[0]?.label, provider === 'openai' ? 'OpenAI API' : 'Claude API');
        picker.acceptSelection(picker.activeItems[0]!);
      };
      return picker;
    });
    context.mock.method(window, 'showInputBox', async (options: import('vscode').InputBoxOptions) => {
      assert.equal(options.password, true);
      assert.equal(options.ignoreFocusOut, true);
      assert.equal(options.value, undefined);
      assert.ok(await options.validateInput!('  '));
      assert.equal(await options.validateInput!('key'), undefined);
      assert.ok(options.title?.includes(provider));
      return input;
    });
    context.mock.method(window, 'showInformationMessage', async (message: string) => { notices.push(message); });
    context.mock.method(window, 'showErrorMessage', async (message: string) => { notices.push(message); });
    context.mock.method(window, 'showWarningMessage', async (_message: string, options: import('vscode').MessageOptions) => {
      assert.equal(options.modal, true);
      return confirmation;
    });
    assert.equal(registerAIKeyCommands(new AiKeyService(storage)).length, 2);
    const set = handlers.get('flowlens.setAiApiKey')! as () => Promise<SetAiApiKeyResult>;
    const remove = handlers.get('flowlens.removeAiApiKey')!;
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

    for (const id of handlers.keys()) {
      assert.ok(manifest.contributes.commands.some((command: { command: string }) => command.command === id));
    }

    const cancelled = await set();
    assertErr(cancelled);
    assert.deepEqual(cancelled.error, { reason: 'cancelled', cause: undefined });
    assert.equal(notices.length, 0);
    input = '  ';
    const invalid = await set();
    assertErr(invalid);
    assert.deepEqual(invalid.error, { reason: 'invalid-api-key', cause: undefined });
    assert.equal(values.size, 0);
    input = ' sensitive-key ';
    const saved = await set();
    assertOk(saved);
    assert.equal(saved.value, 'saved');
    assert.equal(values.get('openai'), 'sensitive-key');
    input = 'replacement-key';
    await set();
    assert.equal(values.get('openai'), 'replacement-key');
    provider = 'anthropic';
    await set();
    await remove();
    assert.equal(values.size, 2);
    confirmation = 'Remove';
    await remove();
    assert.equal(values.has('anthropic'), false);
    assert.equal(values.has('openai'), true);
    await remove();
    assert.match(notices.at(-1)!, /No API key/);
    fail = true;
    const failed = await set();
    assertErr(failed);
    assert.deepEqual(failed.error, { reason: 'configuration-failed', cause: storageFailure });
    assert.equal(failed.error.cause, storageFailure);
    assert.match(notices.at(-1)!, /Could not configure/);
    await remove();
    assert.match(notices.at(-1)!, /Could not remove/);
    assert.equal(notices.join().includes('sensitive-key'), false);
    assert.equal(notices.join().includes('replacement-key'), false);
  });
});

describe('configureAiBackend', () => {
  it('selects Codex without prompting for or accessing API keys, and preserves cancellation and save failures', async context => {
    const handlers = new Map<string, () => Promise<SetAiApiKeyResult>>();
    let backend = 'openai-api';
    let cancel = false;
    let fail = false;
    const updates: unknown[] = [];
    context.mock.method(commands, 'registerCommand', (id: string, handler: () => Promise<SetAiApiKeyResult>) => {
      handlers.set(id, handler);
      return { dispose() {} };
    });
    context.mock.method(workspace, 'getConfiguration', () => ({
      get: () => backend,
      update: async (key: string, value: unknown) => {
        assert.equal(key, 'ai.backend');
        if (fail) throw new Error('settings failure');
        updates.push(value);
        backend = value as string;
      },
    }));
    context.mock.method(window, 'createQuickPick', () => {
      const picker = new MockQuickPick<import('vscode').QuickPickItem & { backend: string }>();
      picker.show = () => {
        assert.equal(picker.activeItems[0]?.backend, backend);
        return cancel ? picker.cancel() : picker.acceptSelection(picker.items.find(item => item.backend === 'codex-cli')!);
      };
      return picker;
    });
    context.mock.method(window, 'showInputBox', async () => assert.fail('Codex must not prompt for an API key'));
    registerAIKeyCommands(new AiKeyService({
      get: async () => assert.fail('Must not read keys'),
      set: async () => assert.fail('Must not write keys'),
      delete: async () => assert.fail('Must not delete keys'),
    }));
    const configure = handlers.get('flowlens.setAiApiKey')!;

    assertOk(await configure());
    assert.equal(backend, 'codex-cli');
    assert.deepEqual(updates, ['codex-cli']);
    cancel = true;
    const cancelled = await configure();
    assertErr(cancelled);
    assert.equal(cancelled.error.reason, 'cancelled');
    assert.deepEqual(updates, ['codex-cli']);
    cancel = false;
    fail = true;
    backend = 'claude-api';
    const failed = await configure();
    assertErr(failed);
    assert.equal(failed.error.reason, 'configuration-failed');
    assert.equal(backend, 'claude-api');
    assert.deepEqual(updates, ['codex-cli']);
  });

  it('selects backends, cancels without writes, and reports partial save failures', async context => {
    const handlers = new Map<string, () => Promise<SetAiApiKeyResult>>();
    const values = new Map<string, string>();
    const updates: unknown[] = [];
    let backend: string | undefined;
    let selection: 'OpenAI API' | 'Claude API' | undefined;
    let input: string | undefined = ' new-key ';
    let storageFails = false;
    let settingsFail = false;
    let inputCalls = 0;
    let lastPicker: MockQuickPick<import('vscode').QuickPickItem> | undefined;

    context.mock.method(commands, 'registerCommand', (id: string, handler: () => Promise<SetAiApiKeyResult>) => {
      handlers.set(id, handler);
      return { dispose() {} };
    });
    context.mock.method(workspace, 'getConfiguration', () => ({
      get: (_key: string, fallback: unknown) => backend ?? fallback,
      update: async (_key: string, value: unknown) => {
        updates.push(value);
        if (settingsFail) throw new Error('settings failure');
        backend = value as string;
      },
    }));
    context.mock.method(window, 'createQuickPick', () => {
      const picker = new MockQuickPick<import('vscode').QuickPickItem>();
      lastPicker = picker;
      picker.show = () => {
        assert.deepEqual(picker.items.map(item => item.label), ['OpenAI API', 'Claude API', 'Codex CLI']);
        assert.equal(picker.activeItems[0]?.label, backend === 'claude-api' ? 'Claude API' : 'OpenAI API');
        return selection ? picker.acceptSelection(picker.items.find(item => item.label === selection)!) : picker.cancel();
      };
      return picker;
    });
    context.mock.method(window, 'showInputBox', async (options: import('vscode').InputBoxOptions) => {
      inputCalls++;
      assert.equal(lastPicker?.disposed, true);
      assert.ok(options.title?.includes(selection === 'Claude API' ? 'anthropic' : 'openai'));
      assert.equal(options.password, true);
      assert.equal(options.value, undefined);
      return input;
    });
    registerAIKeyCommands(new AiKeyService({
      get: async selected => values.get(selected),
      set: async (selected, key) => {
        if (storageFails) throw new Error('storage failure');
        values.set(selected, key);
      },
      delete: async selected => { values.delete(selected); },
    }));
    const configure = handlers.get('flowlens.setAiApiKey')!;
    const cancelledPicker = await configure();
    assertErr(cancelledPicker);
    assert.deepEqual(cancelledPicker.error, { reason: 'cancelled', cause: undefined });
    assert.equal(inputCalls, 0);
    assert.equal(lastPicker?.disposed, true);
    selection = 'Claude API';
    input = undefined;
    const cancelledKey = await configure();
    assertErr(cancelledKey);
    assert.deepEqual(cancelledKey.error, { reason: 'cancelled', cause: undefined });
    assert.equal(values.size, 0);
    assert.deepEqual(updates, []);

    input = ' new-key ';
    const saved = await configure();
    assertOk(saved);
    assert.equal(saved.value, 'saved');
    assert.equal(backend, 'claude-api');
    assert.equal(values.get('anthropic'), 'new-key');
    selection = 'OpenAI API';
    storageFails = true;
    assertErr(await configure());
    assert.deepEqual(updates, ['claude-api']);
    assert.equal(backend, 'claude-api');

    storageFails = false;
    settingsFail = true;
    assertErr(await configure());
    assert.equal(values.get('openai'), 'new-key');
    assert.equal(backend, 'claude-api');
    settingsFail = false;
    assertOk(await configure());
    assert.equal(backend, 'openai-api');
    assert.equal(values.get('anthropic'), 'new-key');
    assert.equal(lastPicker?.disposed, true);
  });
});

describe('selectAiBackend', () => {
  it('disposes acquired resources when listener registration or showing the picker throws', async t => {
    for (const failureStage of ['subscribe', 'show'] as const) {
      await t.test(failureStage, async t => {
        const handlers = new Map<string, () => Promise<SetAiApiKeyResult>>();
        const picker = new MockQuickPick<import('vscode').QuickPickItem>();
        const cause = new Error('picker failed');
        const disposeAccept = t.mock.fn();
        const disposeHide = t.mock.fn();
        const disposePicker = t.mock.method(picker, 'dispose');
        t.mock.method(commands, 'registerCommand', (id: string, handler: () => Promise<SetAiApiKeyResult>) => {
          handlers.set(id, handler);
          return { dispose() {} };
        });
        t.mock.method(window, 'createQuickPick', () => picker);
        t.mock.method(picker, 'onDidAccept', () => ({ dispose: disposeAccept }));
        t.mock.method(picker, 'onDidHide', () => {
          if (failureStage === 'subscribe') throw cause;
          return { dispose: disposeHide };
        });
        t.mock.method(picker, 'show', () => { throw cause; });
        const prompt = t.mock.method(window, 'showInputBox');
        const showError = t.mock.method(window, 'showErrorMessage');
        const saveKey = t.mock.fn(async () => {});
        registerAIKeyCommands(new AiKeyService({
          get: async () => undefined,
          set: saveKey,
          delete: async () => {},
        }));

        const result = await handlers.get('flowlens.setAiApiKey')!();

        assertErr(result);
        assert.deepEqual(result.error, { reason: 'configuration-failed', cause });
        assert.equal(disposeAccept.mock.callCount(), 1);
        assert.equal(disposeHide.mock.callCount(), failureStage === 'show' ? 1 : 0);
        assert.equal(disposePicker.mock.callCount(), 1);
        assert.equal(prompt.mock.callCount(), 0);
        assert.equal(saveKey.mock.callCount(), 0);
        assert.equal(showError.mock.callCount(), 1);
      });
    }
  });
});

describe('executeSetAiApiKeyCommand', () => {
  it('preserves command results, including the original configuration failure cause', async context => {
    const cause = new Error('private storage details');
    const failure = err({ reason: 'configuration-failed' as const, cause });
    let response: SetAiApiKeyResult = ok('saved');
    context.mock.method(commands, 'executeCommand', async (id: string) => {
      assert.equal(id, 'flowlens.setAiApiKey');
      return response;
    });

    for (const result of [ok('saved' as const), err({ reason: 'cancelled' as const, cause: undefined }), failure]) {
      response = result;
      assert.deepEqual(await executeSetAiApiKeyCommand().run(), result);
    }

    const result = await executeSetAiApiKeyCommand().run();
    assertErr(result);
    assert.equal(result.error.cause, cause);
  });

  it('returns an error with the original cause when command execution rejects', async context => {
    const cause = { message: 'private command details' };
    context.mock.method(commands, 'executeCommand', async () => { throw cause; });
    const result = await executeSetAiApiKeyCommand().run();

    assertErr(result);
    assert.equal(result.error.cause, cause);
    assert.equal(result.error.reason, 'command-execution-failed');
  });
});
