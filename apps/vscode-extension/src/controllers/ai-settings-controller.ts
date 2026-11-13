import {
  createVsCodeEvent,
  isAiSettingsGetEvent,
  isAiSettingsSaveEvent,
  type VsCodeEventRegistry,
} from '@flowlens/registries/vscode-events';
import type { AiConfigurationService } from '@services/ai-configuration-service.js';

export type AiSettingsControllerDependencies = { aiConfiguration: AiConfigurationService };
export type AiSettingsEvent = VsCodeEventRegistry['ai.settings.get' | 'ai.settings.save'];
export type AiSettingsEventResult = VsCodeEventRegistry['ai.settings.result' | 'ai.settings.error'];

export class AiSettingsController {
  constructor(private readonly dependencies: AiSettingsControllerDependencies) {}

  async handleEvent(message: unknown): Promise<AiSettingsEventResult | undefined> {
    if (isAiSettingsGetEvent(message)) return this.getSettings(message);
    if (isAiSettingsSaveEvent(message)) return this.saveSettings(message);
  }

  private async getSettings(request: VsCodeEventRegistry['ai.settings.get']): Promise<AiSettingsEventResult> {
    const { requestId } = request.payload;

    try {
      const backend = this.dependencies.aiConfiguration.getAiBackend();
      const [openaiKey, anthropicKey] = await Promise.all([
        this.dependencies.aiConfiguration.getAiApiKey('openai'),
        this.dependencies.aiConfiguration.getAiApiKey('anthropic'),
      ]);

      return createVsCodeEvent('ai.settings.result', {
        requestId,
        configuration: {
          backend,
          credentialPresence: { openai: Boolean(openaiKey), anthropic: Boolean(anthropicKey) },
        },
      });
    } catch {
      return createVsCodeEvent('ai.settings.error', { requestId, reason: 'load-failed' });
    }
  }

  private async saveSettings(request: VsCodeEventRegistry['ai.settings.save']): Promise<AiSettingsEventResult> {
    const { requestId, configuration } = request.payload;
    const { aiConfiguration } = this.dependencies;

    try {
      await aiConfiguration.updateAiBackend(configuration.backend);

      if (configuration.credential) {
        const { provider, apiKey } = configuration.credential;
        await aiConfiguration.setAiApiKey(provider, apiKey.trim());
      }

      const backend = aiConfiguration.getAiBackend();
      const [openaiKey, anthropicKey] = await Promise.all([
        aiConfiguration.getAiApiKey('openai'),
        aiConfiguration.getAiApiKey('anthropic'),
      ]);

      return createVsCodeEvent('ai.settings.result', {
        requestId,
        configuration: {
          backend,
          credentialPresence: { openai: Boolean(openaiKey), anthropic: Boolean(anthropicKey) },
        },
      });
    } catch {
      return createVsCodeEvent('ai.settings.error', { requestId, reason: 'save-failed' });
    }
  }
}
