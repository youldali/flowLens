import type { ChangeEvent } from 'react'
import {
  type I18nKey_CODE_ANALYSIS_CONTEXT,
  useTranslation,
} from '@common/hooks/useTranslation'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import type { LayoutDirection } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import styles from './GraphDirectionSelector.module.css'

const LAYOUT_DIRECTIONS = ['LR', 'TB'] as const satisfies readonly LayoutDirection[]

const DIRECTION_LABEL_KEYS = {
  LR: 'graphVisualization.directions.options.leftToRight',
  TB: 'graphVisualization.directions.options.topToBottom',
} satisfies Record<LayoutDirection, I18nKey_CODE_ANALYSIS_CONTEXT>

export function GraphDirectionSelector() {
  const { t } = useTranslation('code-analysis-context')
  const direction = graphFacade.data.useDirection()
  const selectDirection = graphFacade.actions.useSelectDirection()

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    selectDirection(event.target.value as LayoutDirection)
  }

  return (
    <label className={styles.directionSelector}>
      <span>{t('graphVisualization.directions.label')}</span>
      <select
        className={styles.directionSelect}
        onChange={handleChange}
        value={direction}
      >
        {LAYOUT_DIRECTIONS.map((layoutDirection) => (
          <option key={layoutDirection} value={layoutDirection}>
            {t(DIRECTION_LABEL_KEYS[layoutDirection])}
          </option>
        ))}
      </select>
    </label>
  )
}
