import classNames from 'classnames'
import { useTranslation } from '#common/hooks/useTranslation.ts'
import { QuerySuspense } from '#common/QuerySuspense.tsx'
import { openCliSource } from '#code-analysis-context/graph-visualization/apis/openCliSource.ts'
import { useFetchGraph } from '#code-analysis-context/graph-visualization/apis/fetchGraph.ts'
import { GraphProvider } from '#code-analysis-context/graph-visualization/context/index.ts'
import { GraphViewContent } from './GraphViewContent'
import styles from './GraphView.module.css'

export function FromCli() {
  const graphQuery = useFetchGraph()
  const { t } = useTranslation('code-analysis-context')

  return (
    <main className={styles.container}>
      <QuerySuspense
        queryState={graphQuery}
        loading={
          <div className={styles.status}>
            {t('graphVisualization.loading')}
          </div>
        }
        fallback={(error) => (
          <div className={classNames(styles.status, styles.statusError)}>
            {error.message}
          </div>
        )}
      >
        {(session) => (
          <GraphProvider graphId={session.graphId} graph={session.graph} onOpenSource={openCliSource}>
            <GraphViewContent />
          </GraphProvider>
        )}
      </QuerySuspense>
    </main>
  )
}
