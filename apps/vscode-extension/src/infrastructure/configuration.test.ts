import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { describe, it, mock, afterEach } from 'node:test';
import { ConfigurationTarget, workspace } from '@mocks/vscode.js';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('../mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { getAiBackend, updateAiBackend } = await import('./configuration.js');
hooks.deregister();
afterEach(() => mock.restoreAll());

describe('getAiBackend', () => {
  it('reads the default from the FlowLens configuration when no value exists', () => {
    const configuration = workspace.getConfiguration('flowlens');
    const get = mock.method(configuration, 'get');
    const getConfiguration = mock.method(workspace, 'getConfiguration', () => configuration);

    assert.equal(getAiBackend(), 'openai-api');
    assert.deepEqual(getConfiguration.mock.calls[0]?.arguments, ['flowlens']);
    assert.deepEqual(get.mock.calls[0]?.arguments, ['ai.backend', 'openai-api']);
  });

  it('reads all backends and reflects configuration changes on subsequent reads', () => {
    let backend = 'claude-api';
    mock.method(workspace, 'getConfiguration', () => ({
      get: () => backend,
      update: async () => {},
    }));

    assert.equal(getAiBackend(), 'claude-api');
    backend = 'openai-api';
    assert.equal(getAiBackend(), 'openai-api');
    backend = 'codex-cli';
    assert.equal(getAiBackend(), 'codex-cli');
  });

  it('rejects invalid explicit values', () => {
    for (const backend of ['openai', 'anthropic', 'unsupported', '', null, 42]) {
      mock.method(workspace, 'getConfiguration', () => ({
        get: () => backend,
        update: async () => {},
      }));

      assert.throws(getAiBackend, /Invalid flowlens\.ai\.backend setting/);
    }
  });
});

describe('updateAiBackend', () => {
  it('writes the backend to global configuration', async () => {
    const configuration = workspace.getConfiguration('flowlens');
    const update = mock.method(configuration, 'update');
    const getConfiguration = mock.method(workspace, 'getConfiguration', () => configuration);

    await updateAiBackend('claude-api');

    assert.deepEqual(getConfiguration.mock.calls[0]?.arguments, ['flowlens']);
    assert.deepEqual(update.mock.calls[0]?.arguments, ['ai.backend', 'claude-api', ConfigurationTarget.Global]);
  });

  it('propagates update failures', async () => {
    const error = new Error('Unable to write settings');
    mock.method(workspace, 'getConfiguration', () => ({
      get: () => 'openai-api',
      update: async () => { throw error; },
    }));

    await assert.rejects(updateAiBackend('claude-api'), received => received === error);
  });
});

describe('configuration contribution', () => {
  it('registers the application-scoped backend setting', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

    assert.deepEqual(manifest.contributes.configuration.properties['flowlens.ai.backend'], {
      type: 'string',
      enum: ['openai-api', 'claude-api', 'codex-cli'],
      default: 'openai-api',
      scope: 'application',
      description: 'AI backend used for AI-powered features.',
    });
  });
});
