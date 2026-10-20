import * as vscode from 'vscode';
import { aiProviderSchema, type AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import { createAIKeyStorage, type AIKeyStorage } from './ai-key-storage.js';

export function getAiKeyStorage(context: Pick<vscode.ExtensionContext, 'secrets'>): AIKeyStorage {
  return createAIKeyStorage(context.secrets);
}

export async function getAiApiKey(storage: Pick<AIKeyStorage, 'get'>, provider: AIProvider): Promise<string | undefined> {
  return storage.get(provider);
}

export function getAIProvider(): AIProvider {
  const provider = vscode.workspace.getConfiguration('flowlens').get<unknown>('ai.provider', 'openai');
  const result = aiProviderSchema.safeParse(provider);

  if (!result.success) {
    throw new Error('Invalid flowlens.ai.provider setting: expected "openai" or "anthropic".', { cause: result.error });
  }

  return result.data;
}

export async function updateAIProvider(provider: AIProvider): Promise<void> {
  await vscode.workspace.getConfiguration('flowlens').update('ai.provider', provider, vscode.ConfigurationTarget.Global);
}
