import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';
import { createVsCodeEvent, isAiSettingsResultEvent, isAiSettingsErrorEvent } from '@flowlens/registries/vscode-events';
import { AiConfigurationService } from '@services/ai-configuration-service.js';
import { AiSettingsController } from './ai-settings-controller.js';

describe('handleEvent', () => {
  it('saves each backend and optional trimmed credentials while preserving other keys', async () => {
    for (const selectedBackend of ['openai-api', 'claude-api', 'codex-cli'] as const) {
      for (const supplyCredential of selectedBackend === 'codex-cli' ? [false] : [false, true]) {
        let backend: AiProviderDomain.AiBackend = 'openai-api';
        const keys = { openai: 'existing-openai-secret', anthropic: 'existing-anthropic-secret' };
        const provider = selectedBackend === 'claude-api' ? 'anthropic' : 'openai';
        const controller = new AiSettingsController({
          aiConfiguration: new AiConfigurationService({
            keyStorage: {
              get: async provider => keys[provider],
              set: async (provider, key) => { keys[provider] = key; },
              delete: async () => { assert.fail('Saving must not delete credentials'); },
            },
            backendConfiguration: {
              getBackend: () => backend,
              updateBackend: async selected => { backend = selected; },
            },
          }),
        });
        const requestId = `${selectedBackend}-${supplyCredential}`;
        const response = await controller.handleEvent(createVsCodeEvent('ai.settings.save', {
          requestId,
          configuration: {
            backend: selectedBackend,
            ...(supplyCredential ? { credential: { provider, apiKey: '  new-secret  ' } } : {}),
          },
        }));

        assert.equal(backend, selectedBackend);
        assert.deepEqual(keys, {
          openai: supplyCredential && provider === 'openai' ? 'new-secret' : 'existing-openai-secret',
          anthropic: supplyCredential && provider === 'anthropic' ? 'new-secret' : 'existing-anthropic-secret',
        });
        assert.deepEqual(response, createVsCodeEvent('ai.settings.result', {
          requestId,
          configuration: { backend: selectedBackend, credentialPresence: { openai: true, anthropic: true } },
        }));
      }
    }
  });

  it('awaits backend then key persistence before reading confirmed settings and responding', async () => {
    const backendSaved = Promise.withResolvers<void>();
    const keyStarted = Promise.withResolvers<void>();
    const keySaved = Promise.withResolvers<void>();
    const operations: string[] = [];
    let responded = false;
    const controller = new AiSettingsController({
      aiConfiguration: new AiConfigurationService({
        backendConfiguration: {
          updateBackend: async () => { operations.push('backend'); await backendSaved.promise; },
          getBackend: () => { operations.push('read-backend'); return 'claude-api'; },
        },
        keyStorage: {
          set: async () => { operations.push('key'); keyStarted.resolve(); await keySaved.promise; },
          get: async provider => { operations.push(`read-${provider}`); return provider === 'anthropic' ? 'secret' : undefined; },
          delete: async () => {},
        },
      }),
    });
    const response = controller.handleEvent(createVsCodeEvent('ai.settings.save', {
      requestId: 'ordered',
      configuration: { backend: 'openai-api', credential: { provider: 'openai', apiKey: 'secret' } },
    })).then(result => { responded = true; return result; });

    assert.deepEqual(operations, ['backend']);
    assert.equal(responded, false);
    backendSaved.resolve();
    await keyStarted.promise;
    assert.deepEqual(operations, ['backend', 'key']);
    assert.equal(responded, false);
    keySaved.resolve();
    assert.deepEqual(await response, createVsCodeEvent('ai.settings.result', {
      requestId: 'ordered',
      configuration: { backend: 'claude-api', credentialPresence: { openai: false, anthropic: true } },
    }));
    assert.deepEqual(operations, ['backend', 'key', 'read-backend', 'read-openai', 'read-anthropic']);
  });

  it('returns safe correlated save failures for writes and readback without rolling back the backend', async () => {
    for (const failure of ['write-backend', 'write-key', 'read-backend', 'openai', 'anthropic']) {
      let backend: AiProviderDomain.AiBackend = 'openai-api';
      let keyWritten = false;
      const controller = new AiSettingsController({
        aiConfiguration: new AiConfigurationService({
          backendConfiguration: {
            updateBackend: async selected => {
              if (failure === 'write-backend') throw new Error('secret-error');
              backend = selected;
            },
            getBackend: () => {
              if (failure === 'read-backend') throw new Error('secret-error');
              return backend;
            },
          },
          keyStorage: {
            set: async () => {
              if (failure === 'write-key') throw new Error('secret-error');
              keyWritten = true;
            },
            get: async provider => {
              if (failure === provider) throw new Error('secret-error');
              return undefined;
            },
            delete: async () => {},
          },
        }),
      });
      const response = await controller.handleEvent(createVsCodeEvent('ai.settings.save', {
        requestId: failure,
        configuration: { backend: 'claude-api', credential: { provider: 'anthropic', apiKey: 'secret' } },
      }));

      assert.deepEqual(response, createVsCodeEvent('ai.settings.error', { requestId: failure, reason: 'save-failed' }));
      assert.equal(backend, failure === 'write-backend' ? 'openai-api' : 'claude-api');
      assert.equal(keyWritten, failure !== 'write-backend' && failure !== 'write-key');
    }
  });

  it('reads fresh backend and credential presence on every request without exposing keys', async () => {
    let backend: AiProviderDomain.AiBackend = 'openai-api';
    const keys: Record<AiProviderDomain.AIProvider, string | undefined> = { openai: undefined, anthropic: undefined };
    const controller = new AiSettingsController({
      aiConfiguration: new AiConfigurationService({
        keyStorage: {
          get: async provider => keys[provider], set: async () => {}, delete: async () => {},
        },
        backendConfiguration: { getBackend: () => backend, updateBackend: async () => {} },
      }),
    });

    for (const selectedBackend of ['openai-api', 'claude-api', 'codex-cli'] as const) {
      backend = selectedBackend;

      for (const openai of [undefined, '', 'openai-secret']) {
        for (const anthropic of [undefined, '', 'anthropic-secret']) {
          Object.assign(keys, { openai, anthropic });
          const requestId = `${backend}-${Boolean(openai)}-${Boolean(anthropic)}`;
          const response = await controller.handleEvent(createVsCodeEvent('ai.settings.get', { requestId }));

          assert.ok(isAiSettingsResultEvent(response));
          assert.deepEqual(response, createVsCodeEvent('ai.settings.result', {
            requestId,
            configuration: {
              backend,
              credentialPresence: { openai: Boolean(openai), anthropic: Boolean(anthropic) },
            },
          }));
          assert.equal(JSON.stringify(response).includes('secret'), false);
        }
      }
    }
  });

  it('reads both credentials concurrently', async () => {
    const pending = {
      openai: Promise.withResolvers<string | undefined>(),
      anthropic: Promise.withResolvers<string | undefined>(),
    };
    const requested: AiProviderDomain.AIProvider[] = [];
    const controller = new AiSettingsController({
      aiConfiguration: new AiConfigurationService({
        keyStorage: {
          get: provider => { requested.push(provider); return pending[provider].promise; },
          set: async () => {}, delete: async () => {},
        },
        backendConfiguration: { getBackend: () => 'openai-api', updateBackend: async () => {} },
      }),
    });
    const response = controller.handleEvent(createVsCodeEvent('ai.settings.get', { requestId: 'concurrent' }));
    assert.deepEqual(requested, ['openai', 'anthropic']);
    pending.openai.resolve(undefined);
    pending.anthropic.resolve(undefined);
    assert.ok(isAiSettingsResultEvent(await response));
  });

  it('returns a correlated load failure for backend or credential failures without exposing the cause', async () => {
    for (const failingDependency of ['backend', 'openai', 'anthropic']) {
      const controller = new AiSettingsController({
        aiConfiguration: new AiConfigurationService({
          keyStorage: {
            get: async provider => {
              if (provider === failingDependency) throw new Error('secret-key');
              return undefined;
            },
            set: async () => {}, delete: async () => {},
          },
          backendConfiguration: {
            getBackend: () => {
              if (failingDependency === 'backend') throw new Error('secret-key');
              return 'openai-api';
            },
            updateBackend: async () => {},
          },
        }),
      });
      const response = await controller.handleEvent(createVsCodeEvent('ai.settings.get', { requestId: failingDependency }));

      assert.ok(isAiSettingsErrorEvent(response));
      assert.deepEqual(response, createVsCodeEvent('ai.settings.error', {
        requestId: failingDependency, reason: 'load-failed',
      }));
      assert.equal(JSON.stringify(response).includes('secret-key'), false);
    }
  });
});
