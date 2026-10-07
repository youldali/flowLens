import type { CallableTypeMemberDeclarationNode } from '@flowlens/analyzer-core/domain/node'
import { useTranslation } from '@common/hooks/useTranslation'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import styles from './ImplementationSection.module.css'

export interface ImplementationSectionProps {
  node: CallableTypeMemberDeclarationNode
}

export function ImplementationSection({ node }: ImplementationSectionProps) {
  const onOpenSource = graphFacade.actions.useOnOpenSource()
  const { t } = useTranslation('code-analysis-context')
  return (
    <section className={styles.section}>
      <h3>{t('graphVisualization.nodes.details.implementations')}</h3>
      {node.implementations.length === 0 ? (
        <span>{t('graphVisualization.nodes.details.implementationsEmpty')}</span>
      ) : (
        <ul className={styles.implementationList}>
          {node.implementations.map((entry) => (
            <li key={entry.filePath + ':' + entry.offset}>
              <button
                type="button"
                className={styles.implementationButton}
                onClick={() => onOpenSource?.(entry.filePath, entry.offset)}
                disabled={!onOpenSource}
                title={entry.filePath}
              >
                <strong>{entry.name}</strong>
                <span>{entry.filePath}:{entry.line}:{entry.column}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
