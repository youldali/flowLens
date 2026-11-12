import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import type { AIKeyStoragePort } from '@services/ports/ai-key-storage.js';

export class AiKeyService {
  constructor(private readonly storage: AIKeyStoragePort) {}

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
