import { useId } from 'react'
import {
  type I18nKey_CODE_ANALYSIS_CONTEXT,
  useTranslation,
} from '@common/hooks/useTranslation'
import {
  GRAPH_TRANSFORMER_IDS,
  type GraphTransformerId,
} from '@code-analysis-context/graph-visualization/domain/transformer'
import { useGraphTransformerStore } from '@code-analysis-context/graph-visualization/store'
import styles from './GraphTransformerSelector.module.css'

const TRANSFORMER_LABEL_KEYS = {
  none: 'graphVisualization.transformers.options.none',
  flow: 'graphVisualization.transformers.options.flow',
  projectSource: 'graphVisualization.transformers.options.projectSource',
} satisfies Record<GraphTransformerId, I18nKey_CODE_ANALYSIS_CONTEXT>

export function GraphTransformerSelector() {
  const groupName = useId()
  const { t } = useTranslation('code-analysis-context')
  const selectedTransformer = useGraphTransformerStore((state) => state.selectedTransformer)
  const selectTransformer = useGraphTransformerStore((state) => state.selectTransformer)

  return (
    <fieldset className={styles.transformerSelector}>
      <legend className={styles.transformerLegend}>
        {t('graphVisualization.transformers.label')}
      </legend>
      <div className={styles.transformerOptions}>
        {GRAPH_TRANSFORMER_IDS.map((transformer) => (
          <label className={styles.transformerOption} key={transformer}>
            <input
              checked={selectedTransformer === transformer}
              name={groupName}
              onChange={() => selectTransformer(transformer)}
              type="radio"
              value={transformer}
            />
            <span>{t(TRANSFORMER_LABEL_KEYS[transformer])}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
