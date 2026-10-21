import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import type { AIKeyStorage } from '@infrastructure/ai-key-storage.js';

export class AiKeyService {
  constructor(private readonly storage: AIKeyStorage) {}

  async getAiApiKey(provider: AIProvider): Promise<string | undefined> {
    return this.storage.get(provider);
  }

  async setAiApiKey(provider: AIProvider, key: string): Promise<void> {
    await this.storage.set(provider, key);
  }

  async removeAiApiKey(provider: AIProvider): Promise<void> {
    await this.storage.delete(provider);
  }
}
