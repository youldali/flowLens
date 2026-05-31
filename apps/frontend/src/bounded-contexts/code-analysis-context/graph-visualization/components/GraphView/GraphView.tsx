import { useTranslation } from '@common/hooks/useTranslation'
import { QuerySuspense } from '@common/QuerySuspense'
import { useFetchGraph } from '../../apis/fetchGraph'
import { GraphViewContent } from './GraphViewContent'
import './GraphView.css'

export function GraphView() {
  const graphQuery = useFetchGraph()
  const { t } = useTranslation('code-analysis-context')

  return (
    <main className="graph-view-container">
      <header className="graph-view-container__header">
        <h1>{t('graphVisualization.title')}</h1>
        <p>{t('graphVisualization.description')}</p>
      </header>
      <QuerySuspense
        queryState={graphQuery}
        loading={
          <div className="graph-view-container__status">
            {t('graphVisualization.loading')}
          </div>
        }
        fallback={(error) => (
          <div className="graph-view-container__status graph-view-container__status--error">
            {error.message}
          </div>
        )}
      >
        {(graph) => <GraphViewContent graph={graph} />}
      </QuerySuspense>
    </main>
  )
}
