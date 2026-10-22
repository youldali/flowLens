import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract'
import { useTranslation } from '#common/hooks/useTranslation.ts'
import styles from './ExplanationContent.module.css'

interface ExplanationContentProps {
  explanation: FunctionExplanation
}

export function ExplanationContent({ explanation }: ExplanationContentProps) {
  const { t } = useTranslation('code-analysis-context')

  return (
    <div className={styles.result}>
      <h4>{t('explanation.purpose')}</h4>
      <p>{explanation.purpose}</p>
      {(['behavior', 'sideEffects', 'failureCases', 'uncertainties'] as const).map((field) => (
        explanation[field].length > 0 && (
          <div key={field}>
            <h4>{t(`explanation.${field}`)}</h4>
            <ul>{explanation[field].map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>
        )
      ))}
    </div>
  )
}
