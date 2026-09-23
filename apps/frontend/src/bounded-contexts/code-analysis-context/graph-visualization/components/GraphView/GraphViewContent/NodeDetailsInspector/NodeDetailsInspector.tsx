import { useMemo } from 'react'
import classNames from 'classnames'
import type { Node } from '@flowlens/analyzer-core/node'
import { useTranslation } from '@common/hooks/useTranslation'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import {
  createGraphNodeConnectionSummaries,
  getSourceExcerpt,
  getSourceTarget,
  hasConnections,
} from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import { shouldDisplayNodeLocation } from '../nodePresentation'
import { useNodeTranslations } from '../useNodeTranslations'
import { ConnectionList } from './ConnectionList'
import styles from './NodeDetailsInspector.module.css'

export interface NodeDetailsInspectorProps {
  node: Node
  className?: string | undefined
}

export function NodeDetailsInspector({
  node,
  className,
}: NodeDetailsInspectorProps) {
  const graph = graphFacade.data.useTransformedGraph()
  const onOpenSource = graphFacade.data.useOnOpenSource()
  const onClose = graphFacade.actions.useClearSelection()
  const onSelectNode = graphFacade.actions.useSelectAndFocusNode()
  const onFocusNode = graphFacade.actions.useFocusOnNode()
  const connectionSummaries = useMemo(
    () => createGraphNodeConnectionSummaries(graph, node.id),
    [graph, node.id],
  )
  const sourceTarget = getSourceTarget(node)
  const openSource = onOpenSource && sourceTarget
    ? () => onOpenSource(sourceTarget.filePath, sourceTarget.offset)
    : undefined
  const focusOnNode = onFocusNode
    ? () => onFocusNode(node.id)
    : undefined
  const { t } = useTranslation('code-analysis-context')
  const nodeTranslations = useNodeTranslations()

  const { incomingConnections, outgoingConnections } = connectionSummaries
  const showLocation = shouldDisplayNodeLocation(node.sourceOrigin)
  const sourceExcerpt = getSourceExcerpt(node)

  return (
    <aside
      className={classNames(styles.inspector, className)}
      aria-label={t('graphVisualization.nodes.details.accessibleLabel', {
        name: node.name,
      })}
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
            <span className={styles.secondary} title={node.filePath}>
              {node.filePath}
            </span>
          )}
        </section>
      )}

      <section className={styles.section}>
        <h3>{t('graphVisualization.nodes.details.declaration')}</h3>
        <span>{nodeTranslations.declaration(node.kind)}</span>
      </section>

      {sourceExcerpt && (
        <details className={styles.section}>
          <summary>{t('graphVisualization.nodes.details.source')}</summary>
          <code className={styles.source}>{sourceExcerpt}</code>
        </details>
      )}

      {hasConnections(connectionSummaries) && (
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

      {(openSource || focusOnNode) && (
        <footer className={styles.actions}>
          {openSource && (
            <button type="button" onClick={openSource}>
              {t('graphVisualization.nodes.details.openSource')}
            </button>
          )}
          {focusOnNode && (
            <button type="button" onClick={focusOnNode}>
              {t('graphVisualization.nodes.details.focusNode')}
            </button>
          )}
        </footer>
      )}
    </aside>
  )
}
