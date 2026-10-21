import { useState } from 'react'
import { QuerySuspense } from '#common/QuerySuspense.tsx'
import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import { useConfig } from '#common/config/index.ts'
import { useTranslation } from '#common/hooks/useTranslation.ts'
import { graphFacade } from '#code-analysis-context/graph-visualization/adapters/graphFacade.ts'
import { useExplainNodeQuery } from '../../apis/useExplainNodeQuery'
import { useQueryError } from '#common/hooks/useQueryError.ts'
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
  const errorMessage = useQueryError({
    error,
    namespace: 'code-analysis-context',
    vscodeTranslations: { reason: reason => `explanation.errors.${reason}` as const },
  })
  const showError = error && error !== dismissedError
    && error.reason !== 'cancelled'
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
      <QuerySuspense
        queryState={query}
        keepDataOnError
        loading={<span role="status">{t('explanation.explaining')}</span>}
        refetching={<span role="status">{t('explanation.explaining')}</span>}
        fallback={() => showError ? (
          <div role="alert" className={styles.alert}>
            <p>{errorMessage}</p>
            <button type="button" onClick={() => setDismissedError(error)}>
              {t('explanation.dismiss')}
            </button>
          </div>
        ) : null}
      >
        {(explanation) => (
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
      </QuerySuspense>
    </>
  )
}
