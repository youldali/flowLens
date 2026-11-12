import type * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';
import type { AiBackendConfigurationPort } from '@services/ports/ai-backend-configuration.js';
import type { AIKeyStoragePort } from '@services/ports/ai-key-storage.js';

type AiConfigurationServiceOptions = {
  keyStorage: AIKeyStoragePort;
  backendConfiguration: AiBackendConfigurationPort;
};

export class AiConfigurationService {
  constructor(private readonly options: AiConfigurationServiceOptions) {}

  getAiBackend(): AiProviderDomain.AiBackend {
    return this.options.backendConfiguration.getBackend();
  }

  async updateAiBackend(backend: AiProviderDomain.AiBackend): Promise<void> {
    await this.options.backendConfiguration.updateBackend(backend);
  }

  async getAiApiKey(provider: AiProviderDomain.AIProvider): Promise<string | undefined> {
    return this.options.keyStorage.get(provider);
  }

  async setAiApiKey(provider: AiProviderDomain.AIProvider, key: string): Promise<void> {
    await this.options.keyStorage.set(provider, key);
  }

  async removeAiApiKey(provider: AiProviderDomain.AIProvider): Promise<void> {
    await this.options.keyStorage.delete(provider);
  }
}
