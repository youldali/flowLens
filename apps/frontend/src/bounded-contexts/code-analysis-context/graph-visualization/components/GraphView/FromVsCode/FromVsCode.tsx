import { useTranslation } from '@common/hooks/useTranslation'
import { useVsCodeApi } from '@common/hooks/useVsCodeApi'
import { createVsCodeEvent } from '@flowlens/registries/vscode-events'
import { GraphViewContent } from '../GraphViewContent'
import styles from '../GraphView.module.css'
import { useGraph } from './useGraph'

export function FromVsCode() {
  const graph = useGraph()
  const vscodeApi = useVsCodeApi()
  const { t } = useTranslation('code-analysis-context')

  return (
    <main className={styles.container}>
      {graph ? (
        <GraphViewContent
          graph={graph}
          onOpenSource={(filePath, offset) => {
            vscodeApi.postMessage(createVsCodeEvent('open.source', { filePath, offset }))
          }}
        />
      ) : (
        <div className={styles.status}>
          {t('graphVisualization.loading')}
        </div>
      )}
    </main>
  )
}
