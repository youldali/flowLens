import type { AiBackend } from '@flowlens/code-insights/domain/ai-provider';

export interface AiBackendConfigurationPort {
  getBackend(): AiBackend;
  updateBackend(backend: AiBackend): Promise<void>;
}
