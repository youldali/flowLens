import { useState, type PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { ConfigProvider, type Config, type VsCodeApi } from '@common/config'
import { createAppStore } from '@store'

type ConfigOverrides = Partial<Pick<Config, 'apiBaseUrl' | 'assetBaseUrl' | 'runtimeHost'>> & {
  vscodeApi?: VsCodeApi
}

type AppShellProps = PropsWithChildren<{ config?: ConfigOverrides }>

const defaultVsCodeApi: VsCodeApi = {
  postMessage() {},
}

export function AppShell({ children, config: configOverrides }: AppShellProps) {
  const [store] = useState(createAppStore)
  const config = createConfig(configOverrides)

  return (
    <ConfigProvider config={config}>
      <Provider store={store}>{children}</Provider>
    </ConfigProvider>
  )
}

function createConfig(overrides: ConfigOverrides = {}): Config {
  const apiBaseUrl = overrides.apiBaseUrl ?? 'https://flowlens.test'
  const assetBaseUrl = overrides.assetBaseUrl ?? ''
  const runtimeHost = overrides.runtimeHost ?? 'web-app'

  return runtimeHost === 'vscode'
    ? { apiBaseUrl, assetBaseUrl, runtimeHost, vscodeApi: overrides.vscodeApi ?? defaultVsCodeApi }
    : { apiBaseUrl, assetBaseUrl, runtimeHost }
}
