import { useTranslation } from '@common/hooks/useTranslation'
import { useVsCodeApi } from '@common/hooks/useVsCodeApi'
import { createVsCodeEvent } from '@flowlens/registries/vscode-events'
import { GraphProvider } from '@code-analysis-context/graph-visualization/context'
import { GraphViewContent } from '../GraphViewContent'
import styles from '../GraphView.module.css'
import { useGraph } from './useGraph'

export function FromVsCode() {
  const graph = useGraph()
  const vscodeApi = useVsCodeApi()
  const { t } = useTranslation('code-analysis-context')
  const onOpenSource = (filePath: string, offset: number) => {
    vscodeApi.postMessage(createVsCodeEvent('open.source', { filePath, offset }))
  }

  return (
    <main className={styles.container}>
      {graph ? (
        <GraphProvider graph={graph} onOpenSource={onOpenSource}>
          <GraphViewContent />
        </GraphProvider>
      ) : (
        <div className={styles.status}>
          {t('graphVisualization.loading')}
        </div>
      )}
    </main>
  )
}
