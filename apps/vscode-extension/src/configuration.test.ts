import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { describe, it, mock, afterEach } from 'node:test';
import { ConfigurationTarget, workspace } from './mocks/vscode.js';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('./mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { getAIProvider, updateAIProvider, getAiKeyStorage, getAiApiKey } = await import('./configuration.js');
hooks.deregister();
afterEach(() => mock.restoreAll());

describe('getAiKeyStorage', () => {
  it('uses the extension context secret storage', async () => {
    const get = mock.fn(async (_key: string) => 'stored-key');
    const secrets = { get, store: async () => {}, delete: async () => {}, onDidChange: () => ({ dispose() {} }) };
    const storage = getAiKeyStorage({ secrets });

    assert.equal(await storage.get('anthropic'), 'stored-key');
    assert.deepEqual(get.mock.calls[0]?.arguments, ['flowlens.ai.anthropic.apiKey']);
  });
});

describe('getAiApiKey', () => {
  it('retrieves the specified provider key and propagates missing keys and failures', async () => {
    const get = mock.fn(async (provider: string) => provider === 'openai' ? 'stored-key' : undefined);

    assert.equal(await getAiApiKey({ get }, 'openai'), 'stored-key');
    assert.equal(await getAiApiKey({ get }, 'anthropic'), undefined);
    const error = new Error('Storage unavailable');
    await assert.rejects(getAiApiKey({ get: async () => { throw error; } }, 'openai'), received => received === error);
  });
});

describe('getAIProvider', () => {
  it('reads the default from the FlowLens configuration when no value exists', () => {
    const configuration = workspace.getConfiguration('flowlens');
    const get = mock.method(configuration, 'get');
    const getConfiguration = mock.method(workspace, 'getConfiguration', () => configuration);

    assert.equal(getAIProvider(), 'openai');
    assert.deepEqual(getConfiguration.mock.calls[0]?.arguments, ['flowlens']);
    assert.deepEqual(get.mock.calls[0]?.arguments, ['ai.provider', 'openai']);
  });

  it('reads both providers and reflects configuration changes on subsequent reads', () => {
    let provider = 'anthropic';
    mock.method(workspace, 'getConfiguration', () => ({
      get: () => provider,
      update: async () => {},
    }));

    assert.equal(getAIProvider(), 'anthropic');
    provider = 'openai';
    assert.equal(getAIProvider(), 'openai');
  });

  it('rejects invalid explicit values', () => {
    for (const provider of ['unsupported', '', null, 42]) {
      mock.method(workspace, 'getConfiguration', () => ({
        get: () => provider,
        update: async () => {},
      }));

      assert.throws(getAIProvider, /Invalid flowlens\.ai\.provider setting/);
    }
  });
});

describe('updateAIProvider', () => {
  it('writes the provider to global configuration', async () => {
    const configuration = workspace.getConfiguration('flowlens');
    const update = mock.method(configuration, 'update');
    const getConfiguration = mock.method(workspace, 'getConfiguration', () => configuration);

    await updateAIProvider('anthropic');

    assert.deepEqual(getConfiguration.mock.calls[0]?.arguments, ['flowlens']);
    assert.deepEqual(update.mock.calls[0]?.arguments, ['ai.provider', 'anthropic', ConfigurationTarget.Global]);
  });

  it('propagates update failures', async () => {
    const error = new Error('Unable to write settings');
    mock.method(workspace, 'getConfiguration', () => ({
      get: () => 'openai',
      update: async () => { throw error; },
    }));

    await assert.rejects(updateAIProvider('anthropic'), received => received === error);
  });
});

describe('configuration contribution', () => {
  it('registers the application-scoped provider setting', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

    assert.deepEqual(manifest.contributes.configuration.properties['flowlens.ai.provider'], {
      type: 'string',
      enum: ['openai', 'anthropic'],
      default: 'openai',
      scope: 'application',
      description: 'AI provider used for AI-powered features.',
    });
  });
});
