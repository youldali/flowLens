import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiKeyService } from './ai-key-service.js';

describe('getAiApiKey', () => {
  it('retrieves the specified provider key and propagates missing keys and failures', async () => {
    const service = new AiKeyService({
      get: async provider => provider === 'openai' ? 'stored-key' : undefined,
      set: async () => {},
      delete: async () => {},
    });

    assert.equal(await service.getAiApiKey('openai'), 'stored-key');
    assert.equal(await service.getAiApiKey('anthropic'), undefined);
    const error = new Error('Storage unavailable');
    const failingService = new AiKeyService({
      get: async () => { throw error; },
      set: async () => {},
      delete: async () => {},
    });

    await assert.rejects(failingService.getAiApiKey('openai'), received => received === error);
  });
});
