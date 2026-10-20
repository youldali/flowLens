import type { SecretStorage } from 'vscode';
import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';

export type AIKeyStorage = ReturnType<typeof createAIKeyStorage>;

export function createAIKeyStorage(secrets: Pick<SecretStorage, 'get' | 'store' | 'delete'>) {
  return {
    get: (provider: AIProvider) => secrets.get(`flowlens.ai.${provider}.apiKey`),
    set: (provider: AIProvider, key: string) => secrets.store(`flowlens.ai.${provider}.apiKey`, key),
    delete: (provider: AIProvider) => secrets.delete(`flowlens.ai.${provider}.apiKey`),
  };
}
