import type { NodeId } from '@flowlens/analyzer-core/domain/node'
import { QuerySuspense } from '#common/QuerySuspense.tsx'
import { useConfig } from '#common/config/index.ts'
import { useTranslation } from '#common/hooks/useTranslation.ts'
import { graphFacade } from '#code-analysis-context/graph-visualization/adapters/graphFacade.ts'
import { useExplainNodeQuery } from '../../apis/useExplainNodeQuery'
import { ExplanationError } from './ExplanationError'
import { ExplanationContent } from './ExplanationContent'
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
        <NodeExplanation key={JSON.stringify([graphId, nodeId])} nodeId={nodeId} />
      ) : (
        <>
          <button className={styles.button} type="button" disabled>{t('explanation.explain')}</button>
          <p className={styles.description}>{t('explanation.vscodeRequired')}</p>
        </>
      )}
    </section>
  )
}

function NodeExplanation({ nodeId }: NodeExplanationSectionProps) {
  const { t } = useTranslation('code-analysis-context')
  const query = useExplainNodeQuery(nodeId)
  const isCancelled = query.error?.reason === 'cancelled'
  const showError = query.isError && !query.isFetching && !isCancelled
  const retry = async () => {
    await query.refetch()
  }

  const loading = <span role="status">{t('explanation.explaining')}</span>

  return (
    <>
      {!showError && (
        <button className={styles.button} type="button" disabled={query.isFetching} onClick={() => { void retry() }}>
          {query.isFetching ? t('explanation.explaining') : query.data
            ? t('explanation.explainAgain') : t('explanation.explain')}
        </button>
      )}
      <QuerySuspense queryState={query} keepDataOnError={isCancelled} loading={loading} refetching={loading}
        fallback={(error) => <ExplanationError error={error} onRetry={retry} />}>
        {(explanation) => <ExplanationContent explanation={explanation} />}
      </QuerySuspense>
    </>
  )
}
