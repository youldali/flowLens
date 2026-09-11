import classNames from 'classnames'
import type { NodeId } from '@flowlens/analyzer-core/node'
import {
  hasConnections,
  type GraphNodeDetailsView,
} from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import { useTranslation } from '@common/hooks/useTranslation'
import { shouldDisplayNodeLocation } from '../nodePresentation'
import { useNodeTranslations } from '../useNodeTranslations'
import { ConnectionList } from './ConnectionList'
import styles from './NodeDetailsInspectorView.module.css'

export interface NodeDetailsInspectorViewProps extends GraphNodeDetailsView {
  className?: string | undefined
  onClose: () => void
  onSelectNode: (nodeId: NodeId) => void
  onOpenSource?: () => void
  onFocusNode?: () => void
}

export function NodeDetailsInspectorView(props: NodeDetailsInspectorViewProps) {
  const {
    node,
    incomingConnections,
    outgoingConnections,
    className,
    onClose,
    onSelectNode,
    onOpenSource,
    onFocusNode,
  } = props
  const { t } = useTranslation('code-analysis-context')
  const nodeTranslations = useNodeTranslations()
  const showLocation = shouldDisplayNodeLocation(node.sourceOrigin)

  return (
    <aside
      className={classNames(styles.inspector, className)}
      aria-label={t('graphVisualization.nodes.details.accessibleLabel', { name: node.name })}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <h2 className={styles.title} title={node.name}>{node.name}</h2>
          <span className={styles.category}>
            {nodeTranslations.category(node.kind, node.sourceOrigin)}
          </span>
          <span className={styles.classification}>
            {nodeTranslations.classification(node.sourceOrigin)}
          </span>
        </div>
        <button
          className={styles.closeButton}
          type="button"
          onClick={onClose}
          aria-label={t('graphVisualization.nodes.details.close')}
        >
          ×
        </button>
      </header>

      {showLocation && (
        <section className={styles.section}>
          <h3>{t('graphVisualization.nodes.details.location')}</h3>
          <strong title={node.filePath}>{node.fileName}</strong>
          {node.filePath !== node.fileName && (
            <span className={styles.secondary} title={node.filePath}>{node.filePath}</span>
          )}
        </section>
      )}

      <section className={styles.section}>
        <h3>{t('graphVisualization.nodes.details.declaration')}</h3>
        <span>{nodeTranslations.declaration(node.kind)}</span>
      </section>

      {node.sourceExcerpt && (
        <details className={styles.section}>
          <summary>{t('graphVisualization.nodes.details.source')}</summary>
          <code className={styles.source}>{node.sourceExcerpt}</code>
        </details>
      )}

      {hasConnections(props) && (
        <section className={styles.section}>
          <h3>{t('graphVisualization.nodes.details.connections')}</h3>
          <ConnectionList
            heading={t('graphVisualization.nodes.details.calledBy')}
            connections={incomingConnections}
            onSelectNode={onSelectNode}
          />
          <ConnectionList
            heading={t('graphVisualization.nodes.details.calls')}
            connections={outgoingConnections}
            onSelectNode={onSelectNode}
          />
        </section>
      )}

      {(onOpenSource || onFocusNode) && (
        <footer className={styles.actions}>
          {onOpenSource && (
            <button type="button" onClick={onOpenSource}>
              {t('graphVisualization.nodes.details.openSource')}
            </button>
          )}
          {onFocusNode && (
            <button type="button" onClick={onFocusNode}>
              {t('graphVisualization.nodes.details.focusNode')}
            </button>
          )}
        </footer>
      )}
    </aside>
  )
}
