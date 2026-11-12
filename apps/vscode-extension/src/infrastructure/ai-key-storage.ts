import type { SecretStorage } from 'vscode';
import type { AIKeyStoragePort } from '@services/ports/ai-key-storage.js';

export function createAIKeyStorage(secrets: Pick<SecretStorage, 'get' | 'store' | 'delete'>): AIKeyStoragePort {
  return {
    get: async provider => secrets.get(`flowlens.ai.${provider}.apiKey`),
    set: async (provider, key) => secrets.store(`flowlens.ai.${provider}.apiKey`, key),
    delete: async provider => secrets.delete(`flowlens.ai.${provider}.apiKey`),
  };
}
