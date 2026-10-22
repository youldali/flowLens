import { err, ok, type Result } from 'neverthrow';
import * as vscode from 'vscode';
import { getAIProvider } from '@infrastructure/configuration.js';
import type { AiKeyService } from '@services/ai-key-service.js';

export type SetAiApiKeyError = {
  reason: 'missing-command-result' | 'command-execution-failed' | 'invalid-api-key' | 'configuration-failed';
  cause: unknown;
};
export type SetAiApiKeyResult = Result<'saved' | 'cancelled', SetAiApiKeyError>;

export async function executeSetAiApiKeyCommand(): Promise<SetAiApiKeyResult> {
  try {
    const result = await vscode.commands.executeCommand<SetAiApiKeyResult>('flowlens.setAiApiKey');

    return result ?? err({ reason: 'missing-command-result', cause: undefined });
  } catch (cause) {
    return err({ reason: 'command-execution-failed', cause });
  }
}

export function registerAIKeyCommands(aiKeyService: AiKeyService): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('flowlens.setAiApiKey', () => setAIKey(aiKeyService)),
    vscode.commands.registerCommand('flowlens.removeAiApiKey', () => removeAIKey(aiKeyService)),
  ];
}

async function setAIKey(aiKeyService: AiKeyService): Promise<SetAiApiKeyResult> {
  try {
    const provider = getAIProvider();
    const input = await vscode.window.showInputBox({
      title: `FlowLens: Set ${provider} API Key`,
      prompt: `Enter the API key for ${provider}. This replaces any existing key.`,
      password: true,
      ignoreFocusOut: true,
      validateInput: value => value.trim() ? undefined : 'Enter a non-empty API key.',
    });

    if (input === undefined) return ok('cancelled');
    const key = input.trim();

    if (!key) {
      await vscode.window.showErrorMessage('FlowLens: Enter a non-empty API key.');
      return err({ reason: 'invalid-api-key', cause: undefined });
    }

    await aiKeyService.setAiApiKey(provider, key);
    await vscode.window.showInformationMessage(`FlowLens: API key saved for ${provider}.`);
    return ok('saved');
  } catch (cause) {
    await vscode.window.showErrorMessage('FlowLens: Could not save the AI API key.');
    return err({ reason: 'configuration-failed', cause });
  }
}

async function removeAIKey(aiKeyService: AiKeyService): Promise<void> {
  try {
    const provider = getAIProvider();
    const key = await aiKeyService.getAiApiKey(provider);

    if (key === undefined) {
      await vscode.window.showInformationMessage(`FlowLens: No API key is stored for ${provider}.`);
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `FlowLens: Remove the API key for ${provider}?`, { modal: true }, 'Remove',
    );

    if (confirmation !== 'Remove') return;
    await aiKeyService.removeAiApiKey(provider);
    await vscode.window.showInformationMessage(`FlowLens: API key removed for ${provider}.`);
  } catch {
    await vscode.window.showErrorMessage('FlowLens: Could not remove the AI API key.');
  }
}
