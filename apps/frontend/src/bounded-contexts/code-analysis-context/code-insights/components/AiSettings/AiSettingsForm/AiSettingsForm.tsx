import { useTranslation } from '#common/hooks/useTranslation.ts'
import { useId } from 'react'
import type { AiBackend } from '#code-analysis-context/code-insights/domain/ai-config.ts'
import { useAiSettingsForm, type UseAiSettingsFormOptions } from './useAiSettingsForm'
import { aiBackendLabelKeys, getAiSettingsErrorKey } from '../AiSettings.presentation'
import styles from './AiSettingsForm.module.css'

type AiSettingsFormProps = UseAiSettingsFormOptions & {
  formId: string
}

export function AiSettingsForm({ configuration, onClose, onSavingChange, formId }: AiSettingsFormProps) {
  const { t } = useTranslation('code-analysis-context')
  const keyId = useId()
  const { data, formControl } = useAiSettingsForm({ configuration, onClose, onSavingChange })

  return (
    <form id={formId} className={styles.form} onSubmit={event => { event.preventDefault(); void formControl.save() }} aria-busy={formControl.saving}>
      <fieldset disabled={formControl.saving}>
        <label className={styles.field}>
          {t('ai.settings.backend')}
          <select value={data.backend} onChange={event => data.selectBackend(event.target.value as AiBackend)}>
            {Object.entries(aiBackendLabelKeys).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
          </select>
        </label>
        {data.apiKeyRequired ? (
          <div className={styles.field}>
            <label htmlFor={keyId}>{t(`ai.settings.apiKey.${data.provider}`)}</label>
            <div className={styles.keyInput}>
              <input id={keyId} type={formControl.visible ? 'text' : 'password'} value={data.apiKey}
                autoComplete="off" spellCheck={false} autoCapitalize="none" aria-describedby={`${keyId}-status`}
                onChange={event => data.setApiKey(event.target.value)} />
              <button type="button" aria-label={t(formControl.visible ? 'ai.settings.hideKey' : 'ai.settings.showKey')} aria-pressed={formControl.visible}
                onClick={formControl.toggleVisibility}>{t(formControl.visible ? 'ai.settings.hide' : 'ai.settings.show')}</button>
            </div>
            <div id={`${keyId}-status`} className={styles.hint}>
              <p>{t(configuration.credentialPresence[data.provider] ? 'ai.settings.keyConfigured' : 'ai.settings.keyNotConfigured')}</p>
              {configuration.credentialPresence[data.provider] && <p>{t('ai.settings.keepExistingKey')}</p>}
            </div>
          </div>
        ) : (
          <div className={styles.hint}>
            <p>{t('ai.settings.cliAuthentication')}</p>
            <p>{t('ai.settings.cliSignIn')}</p>
          </div>
        )}
      </fieldset>
      {formControl.saving && <p role="status">{t('ai.settings.saving')}</p>}
      {formControl.error && <p className={styles.feedback} role="alert">{t(getAiSettingsErrorKey(formControl.error, true))}</p>}
    </form>
  )
}
