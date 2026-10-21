import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAIKeyStorage } from './ai-key-storage.js';

describe('createAIKeyStorage', () => {
  it('namespaces, replaces, retrieves across instances, and deletes independent provider keys', async () => {
    const values = new Map<string, string>();
    const secrets = {
      get: async (key: string) => values.get(key),
      store: async (key: string, value: string) => { values.set(key, value); },
      delete: async (key: string) => { values.delete(key); },
    };
    const storage = createAIKeyStorage(secrets);
    await storage.set('openai', 'first');
    await storage.set('anthropic', 'second');
    await storage.set('openai', 'replacement');
    assert.deepEqual([...values], [
      ['flowlens.ai.openai.apiKey', 'replacement'],
      ['flowlens.ai.anthropic.apiKey', 'second'],
    ]);
    assert.equal(await createAIKeyStorage(secrets).get('openai'), 'replacement');
    await storage.delete('openai');
    assert.equal(await storage.get('openai'), undefined);
    assert.equal(await storage.get('anthropic'), 'second');
  });
});
