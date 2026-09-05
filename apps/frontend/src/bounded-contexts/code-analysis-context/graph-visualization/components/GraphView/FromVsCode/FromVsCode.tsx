import { useTranslation } from '@common/hooks/useTranslation'
import { GraphViewContent } from '../GraphViewContent'
import styles from '../GraphView.module.css'
import { useGraph } from './useGraph'

export function FromVsCode() {
  const graph = useGraph()
  const { t } = useTranslation('code-analysis-context')

  return (
    <main className={styles.container}>
      {graph ? (
        <GraphViewContent graph={graph} />
      ) : (
        <div className={styles.status}>
          {t('graphVisualization.loading')}
        </div>
      )}
    </main>
  )
}
