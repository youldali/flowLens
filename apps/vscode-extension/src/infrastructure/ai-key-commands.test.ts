import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { commands, window, workspace } from '@mocks/vscode.js';
import type { AIKeyStorage } from '@infrastructure/ai-key-storage.js';
import { AiKeyService } from '@services/ai-key-service.js';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('../mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { registerAIKeyCommands } = await import('./ai-key-commands.js');
hooks.deregister();

describe('registerAIKeyCommands', () => {
  it('registers palette commands and handles set, cancel, replace, remove, and failures safely', async context => {
    const handlers = new Map<string, () => unknown>();
    const notices: string[] = [];
    let provider = 'openai';
    let input: string | undefined;
    let confirmation: string | undefined;
    let fail = false;
    const values = new Map<string, string>();
    const storage: AIKeyStorage = {
      get: async selected => { if (fail) throw new Error('sensitive-key'); return values.get(selected); },
      set: async (selected, key) => { if (fail) throw new Error(key); values.set(selected, key); },
      delete: async selected => { if (fail) throw new Error('sensitive-key'); values.delete(selected); },
    };
    context.mock.method(commands, 'registerCommand', (id: string, handler: () => unknown) => {
      handlers.set(id, handler);
      return { dispose() {} };
    });
    context.mock.method(workspace, 'getConfiguration', () => ({ get: () => provider, update: async () => {} }));
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
    const set = handlers.get('flowlens.setAiApiKey')!;
    const remove = handlers.get('flowlens.removeAiApiKey')!;
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

    for (const id of handlers.keys()) {
      assert.ok(manifest.contributes.commands.some((command: { command: string }) => command.command === id));
    }

    await set();
    assert.equal(notices.length, 0);
    input = '  ';
    await set();
    assert.equal(values.size, 0);
    input = ' sensitive-key ';
    await set();
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
    await set();
    assert.match(notices.at(-1)!, /Could not save/);
    await remove();
    assert.match(notices.at(-1)!, /Could not remove/);
    assert.equal(notices.join().includes('sensitive-key'), false);
    assert.equal(notices.join().includes('replacement-key'), false);
  });
});
