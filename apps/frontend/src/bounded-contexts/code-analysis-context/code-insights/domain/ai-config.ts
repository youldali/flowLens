import type * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider'

export type { AiBackend } from '@flowlens/code-insights/domain/ai-provider'
export type { AiConfiguration, AiConfigurationChange } from '@flowlens/registries/vscode-events'

export function getAiProvider(backend: AiProviderDomain.AiBackend): AiProviderDomain.AIProvider {
  return backend === 'claude-api' ? 'anthropic' : 'openai'
}

export function isApiKeyRequired(backend: AiProviderDomain.AiBackend): boolean {
  return backend !== 'codex-cli'
}
