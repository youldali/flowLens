import { err, ok, type Result } from 'neverthrow';
import { ResultFlow } from '@youldali/result-flow';
import * as vscode from 'vscode';
import * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';
import type { AiConfigurationService } from '@services/ai-configuration-service.js';

export type SetAiApiKeyError = {
  reason: 'cancelled' | 'command-execution-failed' | 'invalid-api-key' | 'configuration-failed';
  cause: unknown;
};
export type SetAiApiKeyResult = Result<'saved', SetAiApiKeyError>;

export function executeSetAiApiKeyCommand(): ResultFlow<'saved', SetAiApiKeyError> {
  return ResultFlow.from(async () => vscode.commands.executeCommand<SetAiApiKeyResult>('flowlens.setAiApiKey'))
    .catch(cause => err({ reason: 'command-execution-failed' as const, cause }));
}

export function registerAIKeyCommands(aiConfiguration: AiConfigurationService): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('flowlens.setAiApiKey', () => configureAiBackend(aiConfiguration).run()),
    vscode.commands.registerCommand('flowlens.removeAiApiKey', () => removeAIKey(aiConfiguration)),
  ];
}

function configureAiBackend(aiConfiguration: AiConfigurationService): ResultFlow<'saved', SetAiApiKeyError> {
  return ResultFlow.gen<'saved', SetAiApiKeyError>(async function* () {
    const backend = yield* selectAiBackend(aiConfiguration.getAiBackend());

    if (AiProviderDomain.isApiKeyRequired(backend)) {
      const provider = AiProviderDomain.getAiProvider(backend);
      const key = yield* promptAIKey(provider);
      await aiConfiguration.setAiApiKey(provider, key);
    }

    await aiConfiguration.updateAiBackend(backend);
    await vscode.window.showInformationMessage(`FlowLens: AI backend configured for ${backend}.`);
    return 'saved';
  }).catch(async cause => {
    await vscode.window.showErrorMessage('FlowLens: Could not configure the AI backend.');
    return err({ reason: 'configuration-failed' as const, cause });
  });
}

function selectAiBackend(currentBackend: AiProviderDomain.AiBackend): ResultFlow<AiProviderDomain.AiBackend, SetAiApiKeyError> {
  return ResultFlow.from(() => ok(vscode.window.createQuickPick<vscode.QuickPickItem & { backend: AiProviderDomain.AiBackend }>()))
    .chain(picker => {
      const subscriptions: vscode.Disposable[] = [];

      return ResultFlow.from(() => new Promise<Result<AiProviderDomain.AiBackend, SetAiApiKeyError>>(resolve => {
        picker.title = 'FlowLens: Configure AI Backend';
        picker.placeholder = 'Choose an AI backend';
        picker.ignoreFocusOut = true;
        picker.items = AiProviderDomain.aiBackendSchema.options.map(backend => ({
          label: { 'openai-api': 'OpenAI API', 'claude-api': 'Claude API', 'codex-cli': 'Codex CLI' }[backend],
          backend,
        }));
        picker.activeItems = picker.items.filter(item => item.backend === currentBackend);

        subscriptions.push(picker.onDidAccept(() => {
          const selected = picker.selectedItems[0];

          if (selected) resolve(ok(selected.backend));
        }));
        subscriptions.push(picker.onDidHide(() => resolve(err({ reason: 'cancelled', cause: undefined }))));
        picker.show();
      })).finally(() => {
        subscriptions.forEach(subscription => subscription.dispose());
        picker.dispose();
      });
    });
}

function promptAIKey(provider: AiProviderDomain.AIProvider): ResultFlow<string, SetAiApiKeyError> {
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

async function removeAIKey(aiConfiguration: AiConfigurationService): Promise<void> {
  try {
    const backend = aiConfiguration.getAiBackend();
    if (!AiProviderDomain.isApiKeyRequired(backend)) {
      await vscode.window.showInformationMessage('FlowLens: Codex CLI does not use a stored API key.');
      return;
    }

    const provider = AiProviderDomain.getAiProvider(backend);
    const key = await aiConfiguration.getAiApiKey(provider);

    if (key === undefined) {
      await vscode.window.showInformationMessage(`FlowLens: No API key is stored for ${provider}.`);
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `FlowLens: Remove the API key for ${provider}?`, { modal: true }, 'Remove',
    );

    if (confirmation !== 'Remove') return;
    await aiConfiguration.removeAiApiKey(provider);
    await vscode.window.showInformationMessage(`FlowLens: API key removed for ${provider}.`);
  } catch {
    await vscode.window.showErrorMessage('FlowLens: Could not remove the AI API key.');
  }
}
