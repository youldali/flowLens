import { err, ok, type Result } from 'neverthrow';
import * as vscode from 'vscode';
import { aiProviderSchema, type AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import { getAIProvider, updateAIProvider } from '@infrastructure/configuration.js';
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
    vscode.commands.registerCommand('flowlens.setAiApiKey', () => configureAIProvider(aiKeyService)),
    vscode.commands.registerCommand('flowlens.removeAiApiKey', () => removeAIKey(aiKeyService)),
  ];
}

async function configureAIProvider(aiKeyService: AiKeyService): Promise<SetAiApiKeyResult> {
  try {
    const provider = await selectAIProvider(getAIProvider());

    if (provider === undefined) return ok('cancelled');
    const key = await promptAIKey(provider);

    if (key.isErr()) return err(key.error);
    if (key.value === undefined) return ok('cancelled');

    await aiKeyService.setAiApiKey(provider, key.value);
    await updateAIProvider(provider);
    await vscode.window.showInformationMessage(`FlowLens: AI provider configured for ${provider}.`);
    return ok('saved');
  } catch (cause) {
    await vscode.window.showErrorMessage('FlowLens: Could not configure the AI provider.');
    return err({ reason: 'configuration-failed', cause });
  }
}

async function selectAIProvider(currentProvider: AIProvider): Promise<AIProvider | undefined> {
  const picker = vscode.window.createQuickPick<vscode.QuickPickItem & { provider: AIProvider }>();
  picker.title = 'FlowLens: Configure AI Provider';
  picker.placeholder = 'Choose an AI provider';
  picker.ignoreFocusOut = true;
  picker.items = aiProviderSchema.options.map(provider => ({
    label: provider === 'openai' ? 'OpenAI' : 'Anthropic',
    provider,
  }));
  picker.activeItems = picker.items.filter(item => item.provider === currentProvider);

  const subscriptions: vscode.Disposable[] = [];

  try {
    return await new Promise<AIProvider | undefined>(resolve => {
      subscriptions.push(
        picker.onDidAccept(() => {
          const selected = picker.selectedItems[0];

          if (selected) resolve(selected.provider);
        }),
        picker.onDidHide(() => resolve(undefined)),
      );
      picker.show();
    });
  } finally {
    subscriptions.forEach(subscription => subscription.dispose());
    picker.dispose();
  }
}

async function promptAIKey(provider: AIProvider): Promise<Result<string | undefined, SetAiApiKeyError>> {
  const input = await vscode.window.showInputBox({
    title: `FlowLens: Set ${provider} API Key`,
    prompt: `Enter the API key for ${provider}. This replaces any existing key.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? undefined : 'Enter a non-empty API key.',
  });

  if (input === undefined) return ok(undefined);
  const key = input.trim();

  if (!key) {
    await vscode.window.showErrorMessage('FlowLens: Enter a non-empty API key.');
    return err({ reason: 'invalid-api-key', cause: undefined });
  }

  return ok(key);
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
