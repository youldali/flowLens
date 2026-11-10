import { useTranslation } from '#common/hooks/useTranslation.ts'
import type { AiBackend } from '../../domain/ai-config'
import { useAiBackend } from '../../store/ai-config'
import styles from './AiBackendSelector.module.css'

export function AiBackendSelector() {
  const { t } = useTranslation('code-analysis-context')
  const { backend, selectBackend } = useAiBackend()

  return (
    <label className={styles.selector}>
      <span>{t('ai.backend')}</span>
      <select
        className={styles.select}
        value={backend}
        onChange={event => selectBackend(event.target.value as AiBackend)}
      >
        <option value="openai-api">OpenAI API</option>
        <option value="claude-api">Claude API</option>
        <option value="codex-cli">Codex CLI</option>
      </select>
    </label>
  )
}
