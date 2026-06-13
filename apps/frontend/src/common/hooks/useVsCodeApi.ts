import { useConfig } from './useConfig'

export function useVsCodeApi() {
  const config = useConfig()

  if (config.runtimeHost !== 'vscode') {
    throw new Error('useVsCodeApi must be used inside VS Code runtime.')
  }

  return config.vscodeApi
}
