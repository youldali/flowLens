import { useTranslation } from '@common/hooks/useTranslation'
import { useNodeTranslations } from '../../useNodeTranslations'
import { RELATIONSHIP_STROKE_DASHARRAY } from '../../relationshipPresentation'
import styles from './RelationshipLegend.module.css'

export function RelationshipLegend() {
  const { t } = useTranslation('code-analysis-context')
  const nodeTranslations = useNodeTranslations()

  return (
    <ul className={styles.legend} aria-label={t('graphVisualization.relationshipLegend')}>
      {(['calls', 'declares'] as const).map(relationship => (
        <li key={relationship} className={styles.item}>
          <svg className={styles.sample} viewBox="0 0 36 12" aria-hidden="true">
            <path d="M1 6H29" strokeDasharray={RELATIONSHIP_STROKE_DASHARRAY[relationship]} />
            <path className={styles.arrow} d="M29 2L35 6L29 10Z" />
          </svg>
          <span>{nodeTranslations.relationship(relationship)}</span>
        </li>
      ))}
    </ul>
  )
}
