import { useTranslation } from '#common/hooks/useTranslation.ts'
import { QuerySuspense } from '#common/QuerySuspense.tsx'
import { useRef, useState } from 'react'
import { useFetchAiConfiguration } from '#code-analysis-context/code-insights/apis/ai-settings/useFetchAiConfiguration.ts'
import { AiSettingsModal } from './AiSettingsModal'
import { aiBackendLabelKeys } from './AiSettings.presentation'
import styles from './AiSettings.module.css'

export function AiSettings() {
  const { t } = useTranslation('code-analysis-context')
  const query = useFetchAiConfiguration()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button ref={trigger} type="button" className={styles.trigger} aria-label={t('ai.settings.open')}
        aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <QuerySuspense queryState={query}
          loading={<span role="status">{t('ai.settings.loading')}</span>}
          fallback={() => <span>{t('ai.settings.title')}</span>}>
          {configuration => <span>{t('ai.settings.toolbarLabel', { backend: t(aiBackendLabelKeys[configuration.backend]) })}</span>}
        </QuerySuspense> <span aria-hidden="true">⚙</span>
      </button>
      {open && <AiSettingsModal onClose={() => { setOpen(false); trigger.current?.focus() }} />}
    </>
  )
}
