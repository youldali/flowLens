import { err, ok, type Result } from 'neverthrow';
import { ResultFlow } from '@youldali/result-flow';
import * as vscode from 'vscode';
import { aiProviderSchema, type AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import { getAIProvider, updateAIProvider } from '@infrastructure/configuration.js';
import type { AiKeyService } from '@services/ai-key-service.js';

export type SetAiApiKeyError = {
  reason: 'cancelled' | 'missing-command-result' | 'command-execution-failed' | 'invalid-api-key' | 'configuration-failed';
  cause: unknown;
};
export type SetAiApiKeyResult = Result<'saved', SetAiApiKeyError>;

export function executeSetAiApiKeyCommand(): ResultFlow<'saved', SetAiApiKeyError> {
  return ResultFlow.gen<'saved', SetAiApiKeyError>(async function* ({ fail }) {
    let result: SetAiApiKeyResult | undefined;
    try {
      result = await vscode.commands.executeCommand<SetAiApiKeyResult>('flowlens.setAiApiKey');
    } catch (cause) {
      return fail({ reason: 'command-execution-failed', cause });
    }

    if (!result) return fail({ reason: 'missing-command-result', cause: undefined });
    return yield* result;
  });
}

export function registerAIKeyCommands(aiKeyService: AiKeyService): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('flowlens.setAiApiKey', () => configureAIProvider(aiKeyService).run()),
    vscode.commands.registerCommand('flowlens.removeAiApiKey', () => removeAIKey(aiKeyService)),
  ];
}

function configureAIProvider(aiKeyService: AiKeyService): ResultFlow<'saved', SetAiApiKeyError> {
  return ResultFlow.gen<'saved', SetAiApiKeyError>(async function* ({ fail }) {
    try {
      return yield* await ResultFlow.gen<'saved', SetAiApiKeyError>(async function* () {
        const provider = yield* selectAIProvider(getAIProvider());
        const key = yield* promptAIKey(provider);

        await aiKeyService.setAiApiKey(provider, key);
        await updateAIProvider(provider);
        await vscode.window.showInformationMessage(`FlowLens: AI provider configured for ${provider}.`);
        return 'saved';
      }).run();
    } catch (cause) {
      await vscode.window.showErrorMessage('FlowLens: Could not configure the AI provider.');
      return fail({ reason: 'configuration-failed', cause });
    }
  });
}

function selectAIProvider(currentProvider: AIProvider): ResultFlow<AIProvider, SetAiApiKeyError> {
  return ResultFlow.gen<AIProvider, SetAiApiKeyError>(async function* () {
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
    let selectionResult: Result<AIProvider, SetAiApiKeyError>;

    try {
      selectionResult = await new Promise<Result<AIProvider, SetAiApiKeyError>>(resolve => {
        subscriptions.push(
          picker.onDidAccept(() => {
            const selected = picker.selectedItems[0];

            if (selected) resolve(ok(selected.provider));
          }),
          picker.onDidHide(() => resolve(err({ reason: 'cancelled', cause: undefined }))),
        );
        picker.show();
      });
    } finally {
      subscriptions.forEach(subscription => subscription.dispose());
      picker.dispose();
    }

    // Yield only after disposal: an Err stops the generator without resuming it.
    return yield* selectionResult;
  });
}

function promptAIKey(provider: AIProvider): ResultFlow<string, SetAiApiKeyError> {
  return ResultFlow.gen<string, SetAiApiKeyError>(async function* ({ fail }) {
    const input = await vscode.window.showInputBox({
      title: `FlowLens: Set ${provider} API Key`,
      prompt: `Enter the API key for ${provider}. This replaces any existing key.`,
      password: true,
      ignoreFocusOut: true,
      validateInput: value => value.trim() ? undefined : 'Enter a non-empty API key.',
    });

    if (input === undefined) return fail({ reason: 'cancelled', cause: undefined });
    const key = input.trim();

    if (!key) {
      await vscode.window.showErrorMessage('FlowLens: Enter a non-empty API key.');
      return fail({ reason: 'invalid-api-key', cause: undefined });
    }

    return key;
  });
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
