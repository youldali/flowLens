import { useTranslation } from '@common/hooks/useTranslation'
import { GraphTransformerSelector } from '../GraphTransformerSelector'
import styles from './GraphToolbar.module.css'

type GraphToolbarProps = {
  onFitView: () => void
  rootLabel?: string | undefined
}

export function GraphToolbar({ onFitView, rootLabel }: GraphToolbarProps) {
  const { t } = useTranslation('code-analysis-context')

  return (
    <header className={styles.toolbar}>
      {rootLabel ? (
        <span className={styles.rootLabel} title={rootLabel}>
          {rootLabel}
        </span>
      ) : null}
      <GraphTransformerSelector />
      <button className={styles.fitButton} onClick={onFitView} type="button">
        {t('graphVisualization.fit')}
      </button>
    </header>
  )
}
