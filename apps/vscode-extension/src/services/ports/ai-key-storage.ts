import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';

export interface AIKeyStoragePort {
  get(provider: AIProvider): Promise<string | undefined>;
  set(provider: AIProvider, key: string): Promise<void>;
  delete(provider: AIProvider): Promise<void>;
}
