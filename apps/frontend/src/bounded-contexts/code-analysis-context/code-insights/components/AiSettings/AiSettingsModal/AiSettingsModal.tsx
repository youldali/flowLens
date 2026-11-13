import { useTranslation } from '#common/hooks/useTranslation.ts'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { QuerySuspense } from '#common/QuerySuspense.tsx'
import { useFetchAiConfiguration } from '#code-analysis-context/code-insights/apis/ai-settings/useFetchAiConfiguration.ts'
import { AiSettingsForm } from '../AiSettingsForm'
import { getAiSettingsErrorKey } from '../AiSettings.presentation'
import styles from './AiSettingsModal.module.css'

export function AiSettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('code-analysis-context')
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const subtitleId = useId()
  const [saving, setSaving] = useState(false)
  const aiConfigurationQuery = useFetchAiConfiguration()
  const close = () => {
    dialog.current?.close()
    onClose()
  }

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={subtitleId} tabIndex={-1}
      onKeyDown={trapDialogFocus}
      onCancel={event => { event.preventDefault(); if (!saving) close() }}>
      <header className={styles.header}>
        <div>
          <h2 id={titleId}>{t('ai.settings.title')}</h2>
          <p id={subtitleId}>{t('ai.settings.subtitle')}</p>
        </div>
        <button type="button" className={styles.close} aria-label={t('ai.settings.close')} disabled={saving} onClick={close}>×</button>
      </header>
      <QuerySuspense queryState={aiConfigurationQuery}
        loading={<p role="status">{t('ai.settings.loading')}</p>}
        refetching={<p role="status">{t('ai.settings.loading')}</p>}
        fallback={error => (
          <div className={styles.feedback}>
            <p role="alert">{t(getAiSettingsErrorKey(error.reason))}</p>
            <button type="button" onClick={() => { void aiConfigurationQuery.refetch() }}>{t('ai.settings.retry')}</button>
          </div>
        )}>
        {configuration => aiConfigurationQuery.isFetching ? <></> : (
          <AiSettingsForm formId={`${titleId}-form`} configuration={configuration} onClose={close} onSavingChange={setSaving} />
        )}
      </QuerySuspense>
      <footer className={styles.footer}>
        <button type="button" disabled={saving} onClick={close}>{t('ai.settings.cancel')}</button>
        <button type="submit" form={`${titleId}-form`} className={styles.save}
          disabled={saving || aiConfigurationQuery.isFetching || !aiConfigurationQuery.isSuccess}>
          {t(saving ? 'ai.settings.savingButton' : 'ai.settings.save')}
        </button>
      </footer>
    </dialog>
  )
}

function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)')
  const first = controls[0]
  const last = controls[controls.length - 1]

  if (!first || !last) {
    event.preventDefault()
    event.currentTarget.focus()
  } else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
