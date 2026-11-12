import type { I18nKey_CODE_ANALYSIS_CONTEXT } from '#common/hooks/useTranslation.ts'
import type { AiSettingsErrorReason } from '#code-analysis-context/code-insights/apis/ai-settings/requestAiSettings.ts'
import type { AiBackend } from '@flowlens/code-insights/domain/ai-provider'

export const aiBackendLabelKeys = {
  'openai-api': 'ai.settings.backends.openai-api',
  'claude-api': 'ai.settings.backends.claude-api',
  'codex-cli': 'ai.settings.backends.codex-cli',
} satisfies Record<AiBackend, I18nKey_CODE_ANALYSIS_CONTEXT>

export function getAiSettingsErrorKey(reason: AiSettingsErrorReason, saving = false): I18nKey_CODE_ANALYSIS_CONTEXT {
  if (reason === 'unsupported') return 'ai.settings.errors.unsupported'
  if (reason === 'timed-out') return saving
    ? 'ai.settings.errors.saveTimeout'
    : 'ai.settings.errors.loadTimeout'

  return saving ? 'ai.settings.errors.saveFailed' : 'ai.settings.errors.loadFailed'
}
