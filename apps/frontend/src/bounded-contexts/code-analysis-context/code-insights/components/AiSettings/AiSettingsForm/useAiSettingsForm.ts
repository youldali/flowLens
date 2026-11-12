import { useEffect, useRef, useState } from 'react'
import * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider'
import { useSaveAiConfiguration } from '#code-analysis-context/code-insights/apis/ai-settings/useSaveAiConfiguration.ts'
import type { AiConfiguration } from '@flowlens/registries/vscode-events'

export type UseAiSettingsFormOptions = {
  configuration: AiConfiguration
  onClose: () => void
  onSavingChange: (saving: boolean) => void
}

export function useAiSettingsForm({ configuration, onClose, onSavingChange }: UseAiSettingsFormOptions) {
  const { mutateAsync: saveAiConfiguration, isLoading: saving, error } = useSaveAiConfiguration()
  const [backend, setBackend] = useState(configuration.backend)
  const [keys, setKeys] = useState<Record<AiProviderDomain.AIProvider, string>>({ openai: '', anthropic: '' })
  const [visible, setVisible] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const provider = AiProviderDomain.getAiProvider(backend)
  const apiKeyRequired = AiProviderDomain.isApiKeyRequired(backend)

  useEffect(() => () => pending.current?.abort(), [])

  const save = async () => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    onSavingChange(true)
    const apiKey = keys[provider].trim()

    try {
      // Keep secrets out of Redux, React Query mutation caches, and Explain requests.
      await saveAiConfiguration({
        configuration: {
          backend,
          ...(apiKeyRequired && apiKey ? { credential: { provider, apiKey } } : {}),
        },
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      onClose()
    } catch {
      // React Query exposes the save failure through mutation.error.
    } finally {
      pending.current = null
      if (!controller.signal.aborted) {
        onSavingChange(false)
      }
    }
  }

  const selectBackend = (selectedBackend: AiProviderDomain.AiBackend) => {
    setBackend(selectedBackend)
    setVisible(false)
  }
  const setApiKey = (apiKey: string) => {
    setKeys(previous => ({ ...previous, [provider]: apiKey }))
  }
  const toggleVisibility = () => setVisible(previous => !previous)

  return {
    data: {
      backend,
      provider,
      apiKeyRequired,
      apiKey: keys[provider],
      selectBackend,
      setApiKey,
    },
    formControl: {
      visible,
      saving,
      error: error?.reason,
      save,
      toggleVisibility,
    },
  }
}
