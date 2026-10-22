import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import type { ExplanationErrorReason } from '../../../apis/useExplainNodeQuery'
import { useConfigureAiProvider } from '../../../apis/useConfigureAiProvider'
import { useGenerateGraph } from '../../../apis/useGenerateGraph'
import { getExplanationErrorPresentation } from './ExplanationError.presentation'
import { useTranslation } from '#common/hooks/useTranslation.ts'
import styles from './ExplanationError.module.css'

interface ExplanationErrorProps {
  error: VsCodeQueryError<ExplanationErrorReason>
  onRetry: () => Promise<void>
}

export function ExplanationError({ error, onRetry }: ExplanationErrorProps) {
  const { t } = useTranslation('code-analysis-context')
  const configuration = useConfigureAiProvider()
  const graphGeneration = useGenerateGraph()
  const presentation = getExplanationErrorPresentation(error.reason, error.statusCode, {
    configured: configuration.data === 'saved',
    configurationFailed: configuration.isError && configuration.error.reason !== 'cancelled',
    generationFailed: graphGeneration.isError,
  })

  const pending = configuration.isLoading
  const actions = { 'configure-ai-provider': configuration.mutate, 'generate-graph': graphGeneration.mutate, retry: onRetry }
  const action = presentation?.action

  return presentation ? (
    <div className={styles.feedback} data-severity={presentation.severity}
      role={presentation.severity === 'error' ? 'alert' : 'status'} aria-busy={pending}>
      <span className={styles.icon} aria-hidden="true">{presentation.severity === 'info' ? 'ⓘ' : '⚠'}</span>
      <div className={styles.content}>
        <strong>{t(presentation.title)}</strong>
        <p>{t(presentation.description)}</p>
        {action && (
          <button type="button" disabled={pending} onClick={() => { void actions[action]() }}>
            {t(pending ? 'explanation.configuring' : `explanation.actions.${action}`)}
          </button>
        )}
      </div>
    </div>
  ) : null
}
