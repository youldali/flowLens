import { useTranslation } from '@common/hooks/useTranslation'
import styles from './GraphView.module.css'

export function GraphViewHeader() {
  const { t } = useTranslation('code-analysis-context')

  return (
    <header className={styles.header}>
      <h1>{t('graphVisualization.title')}</h1>
      <p>{t('graphVisualization.description')}</p>
    </header>
  )
}
