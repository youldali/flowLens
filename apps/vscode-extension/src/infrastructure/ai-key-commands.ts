import * as vscode from 'vscode';
import { getAIProvider } from '@infrastructure/configuration.js';
import type { AiKeyService } from '@services/ai-key-service.js';

export function registerAIKeyCommands(aiKeyService: AiKeyService): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('flowlens.setAiApiKey', () => setAIKey(aiKeyService)),
    vscode.commands.registerCommand('flowlens.removeAiApiKey', () => removeAIKey(aiKeyService)),
  ];
}

async function setAIKey(aiKeyService: AiKeyService): Promise<void> {
  try {
    const provider = getAIProvider();
    const input = await vscode.window.showInputBox({
      title: `FlowLens: Set ${provider} API Key`,
      prompt: `Enter the API key for ${provider}. This replaces any existing key.`,
      password: true,
      ignoreFocusOut: true,
      validateInput: value => value.trim() ? undefined : 'Enter a non-empty API key.',
    });

    if (input === undefined) return;
    const key = input.trim();

    if (!key) {
      await vscode.window.showErrorMessage('FlowLens: Enter a non-empty API key.');
      return;
    }

    await aiKeyService.setAiApiKey(provider, key);
    await vscode.window.showInformationMessage(`FlowLens: API key saved for ${provider}.`);
  } catch {
    await vscode.window.showErrorMessage('FlowLens: Could not save the AI API key.');
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
