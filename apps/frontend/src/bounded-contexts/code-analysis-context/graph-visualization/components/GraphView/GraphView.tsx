import classNames from 'classnames'
import { useTranslation } from '@common/hooks/useTranslation'
import { QuerySuspense } from '@common/QuerySuspense'
import { useFetchGraph } from '@code-analysis-context/graph-visualization/apis/fetchGraph'
import { GraphViewContent } from './GraphViewContent'
import styles from './GraphView.module.css'

export function GraphView() {
  const graphQuery = useFetchGraph()
  const { t } = useTranslation('code-analysis-context')

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1>{t('graphVisualization.title')}</h1>
        <p>{t('graphVisualization.description')}</p>
      </header>
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
        {(graph) => <GraphViewContent graph={graph} />}
      </QuerySuspense>
    </main>
  )
}
