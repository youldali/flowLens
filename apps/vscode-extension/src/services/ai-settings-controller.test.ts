import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';
import { createVsCodeEvent, isAiSettingsResultEvent, isAiSettingsErrorEvent } from '@flowlens/registries/vscode-events';
import { AiConfigurationService } from './ai-configuration-service.js';
import { AiSettingsController } from './ai-settings-controller.js';

describe('handleEvent', () => {
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
