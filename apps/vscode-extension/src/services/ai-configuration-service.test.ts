import type { AiBackend } from '@flowlens/code-insights/domain/ai-provider';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiConfigurationService } from './ai-configuration-service.js';

describe('getAiApiKey', () => {
  it('retrieves the specified provider key and propagates missing keys and failures', async () => {
    const service = new AiConfigurationService({
      keyStorage: {
        get: async provider => provider === 'openai' ? 'stored-key' : undefined,
        set: async () => {},
        delete: async () => {},
      },
      backendConfiguration: { getBackend: () => 'openai-api', updateBackend: async () => {} },
    });

    assert.equal(await service.getAiApiKey('openai'), 'stored-key');
    assert.equal(await service.getAiApiKey('anthropic'), undefined);
    const error = new Error('Storage unavailable');
    const failingService = new AiConfigurationService({
      keyStorage: {
        get: async () => { throw error; },
        set: async () => {},
        delete: async () => {},
      },
      backendConfiguration: { getBackend: () => 'openai-api', updateBackend: async () => {} },
    });

    await assert.rejects(failingService.getAiApiKey('openai'), received => received === error);
  });
});

describe('updateAiBackend', () => {
  it('awaits persistence, reads fresh settings, and propagates write failures', async () => {
    let backend: AiBackend = 'openai-api';
    const persisted = Promise.withResolvers<void>();
    const error = new Error('Configuration unavailable');
    let fail = false;
    const service = new AiConfigurationService({
      keyStorage: { get: async () => undefined, set: async () => {}, delete: async () => {} },
      backendConfiguration: {
        getBackend: () => backend,
        updateBackend: async selected => {
          if (fail) throw error;
          await persisted.promise;
          backend = selected;
        },
      },
    });

    const updating = service.updateAiBackend('claude-api');
    assert.equal(service.getAiBackend(), 'openai-api');
    persisted.resolve();
    await updating;
    assert.equal(service.getAiBackend(), 'claude-api');
    backend = 'codex-cli';
    assert.equal(service.getAiBackend(), 'codex-cli');
    fail = true;
    await assert.rejects(service.updateAiBackend('openai-api'), received => received === error);
    assert.equal(service.getAiBackend(), 'codex-cli');
  });
});
