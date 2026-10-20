import * as vscode from 'vscode';
import { getAIProvider, getAiApiKey } from './configuration.js';
import type { AIKeyStorage } from './ai-key-storage.js';

export function registerAIKeyCommands(storage: AIKeyStorage): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('flowlens.setAiApiKey', () => setAIKey(storage)),
    vscode.commands.registerCommand('flowlens.removeAiApiKey', () => removeAIKey(storage)),
  ];
}

async function setAIKey(storage: AIKeyStorage): Promise<void> {
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

    await storage.set(provider, key);
    await vscode.window.showInformationMessage(`FlowLens: API key saved for ${provider}.`);
  } catch {
    await vscode.window.showErrorMessage('FlowLens: Could not save the AI API key.');
  }
}

async function removeAIKey(storage: AIKeyStorage): Promise<void> {
  try {
    const provider = getAIProvider();
    const key = await getAiApiKey(storage, provider);

    if (key === undefined) {
      await vscode.window.showInformationMessage(`FlowLens: No API key is stored for ${provider}.`);
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `FlowLens: Remove the API key for ${provider}?`, { modal: true }, 'Remove',
    );

    if (confirmation !== 'Remove') return;
    await storage.delete(provider);
    await vscode.window.showInformationMessage(`FlowLens: API key removed for ${provider}.`);
  } catch {
    await vscode.window.showErrorMessage('FlowLens: Could not remove the AI API key.');
  }
}
