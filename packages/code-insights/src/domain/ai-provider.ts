import { z } from 'zod';

export const aiProviderSchema = z.enum(['openai', 'anthropic']);

export type AIProvider = z.infer<typeof aiProviderSchema>;

export const aiBackendSchema = z.enum(['openai-api', 'claude-api', 'codex-cli']);

export type AiBackend = z.infer<typeof aiBackendSchema>;

export function getAiProvider(backend: AiBackend): AIProvider {
  return backend === 'claude-api' ? 'anthropic' : 'openai';
}

export function isApiKeyRequired(backend: AiBackend): boolean {
  return backend !== 'codex-cli';
}
