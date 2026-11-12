import * as vscode from 'vscode';
import * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';

export function getAiBackend(): AiProviderDomain.AiBackend {
  const backend = vscode.workspace.getConfiguration('flowlens').get<unknown>('ai.backend', 'openai-api');
  const result = AiProviderDomain.aiBackendSchema.safeParse(backend);

  if (!result.success) {
    throw new Error('Invalid flowlens.ai.backend setting: expected "openai-api", "claude-api", or "codex-cli".', { cause: result.error });
  }

  return result.data;
}

export async function updateAiBackend(backend: AiProviderDomain.AiBackend): Promise<void> {
  await vscode.workspace.getConfiguration('flowlens').update('ai.backend', backend, vscode.ConfigurationTarget.Global);
}
