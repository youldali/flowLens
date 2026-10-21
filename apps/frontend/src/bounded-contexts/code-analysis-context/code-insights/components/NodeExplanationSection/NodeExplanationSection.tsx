import { useState } from 'react'
import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import { useConfig } from '#common/config/index.ts'
import { useTranslation } from '#common/hooks/useTranslation.ts'
import { graphFacade } from '#code-analysis-context/graph-visualization/adapters/graphFacade.ts'
import { useExplainNodeQuery } from '../../apis/useExplainNodeQuery'
import { ExplanationTransportError } from '../../apis/useExplainNodeQuery/requestNodeExplanation'
import styles from './NodeExplanationSection.module.css'

interface NodeExplanationSectionProps {
  nodeId: NodeId
}

export function NodeExplanationSection({ nodeId }: NodeExplanationSectionProps) {
  const { runtimeHost } = useConfig()
  const graphId = graphFacade.data.useGraphId()
  const { t } = useTranslation('code-analysis-context')

  return (
    <section className={styles.section} aria-label={t('explanation.title')}>
      <h3>{t('explanation.title')}</h3>
      {runtimeHost === 'vscode' ? (
        <ConnectedExplanation key={JSON.stringify([graphId, nodeId])} nodeId={nodeId} />
      ) : (
        <>
          <button type="button" disabled>{t('explanation.explain')}</button>
          <p>{t('explanation.vscodeRequired')}</p>
        </>
      )}
    </section>
  )
}

function ConnectedExplanation({ nodeId }: NodeExplanationSectionProps) {
  const query = useExplainNodeQuery(nodeId)
  const [dismissedError, setDismissedError] = useState<unknown>(null)
  const { t } = useTranslation('code-analysis-context')
  const error = query.error
  const showError = error && error !== dismissedError && !query.isFetching
    && !(error instanceof ExplanationTransportError && error.reason === 'cancelled')
  const explanation = query.data

  return (
    <>
      <button type="button" disabled={query.isFetching} onClick={() => {
        setDismissedError(error)
        void query.refetch()
      }}>
        {query.isFetching ? t('explanation.explaining') : explanation
          ? t('explanation.explainAgain') : t('explanation.explain')}
      </button>
      {query.isFetching && <span role="status">{t('explanation.explaining')}</span>}
      {showError && (
        <div role="alert" className={styles.alert}>
          <p>{t(getErrorTranslationKey(error))}</p>
          <button type="button" onClick={() => setDismissedError(error)}>
            {t('explanation.dismiss')}
          </button>
        </div>
      )}
      {explanation && (
        <div className={styles.result}>
          <h4>{t('explanation.purpose')}</h4>
          <p>{explanation.purpose}</p>
          {(['behavior', 'sideEffects', 'failureCases', 'uncertainties'] as const).map((field) => (
            explanation[field].length > 0 && (
              <div key={field}>
                <h4>{t(`explanation.${field}`)}</h4>
                <ul>{explanation[field].map((item, index) => <li key={index}>{item}</li>)}</ul>
              </div>
            )
          ))}
        </div>
      )}
    </>
  )
}

function getErrorTranslationKey(error: unknown) {
  return error instanceof ExplanationTransportError
    ? `explanation.errors.${error.reason}` as const
    : 'explanation.errors.unknown' as const
}
