import { AiConfigurationService } from '@services/ai-configuration-service.js';
import type { AIKeyStoragePort } from '@services/ports/ai-key-storage.js';
import type { AiBackendConfigurationPort } from '@services/ports/ai-backend-configuration.js';
import { createExplainFunction } from '@infrastructure/explain-function.js';

type ServicePorts = {
  keyStorage: AIKeyStoragePort;
  backendConfiguration: AiBackendConfigurationPort;
};

export function createServices(ports: ServicePorts) {
  const aiConfiguration = new AiConfigurationService(ports);

  return {
    aiConfiguration,
    explainFunction: createExplainFunction(
      provider => aiConfiguration.getAiApiKey(provider),
      () => aiConfiguration.getAiBackend(),
    ),
  };
}
