import classNames from 'classnames'
import { useTranslation } from '@common/hooks/useTranslation'
import { QuerySuspense } from '@common/QuerySuspense'
import { useFetchGraph } from '@code-analysis-context/graph-visualization/apis/fetchGraph'
import { GraphViewContent } from './GraphViewContent'
import { GraphViewHeader } from './GraphViewHeader'
import styles from './GraphView.module.css'

export function FromCli() {
  const graphQuery = useFetchGraph()
  const { t } = useTranslation('code-analysis-context')

  return (
    <main className={styles.container}>
      <GraphViewHeader />
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
