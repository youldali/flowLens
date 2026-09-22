import type { PropsWithChildren } from 'react'

import type { Config } from './config'
import { ConfigContext } from './configContext'

type ConfigProviderProps = PropsWithChildren<{
  config: Config
}>

export function ConfigProvider({ children, config }: ConfigProviderProps) {
  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  )
}
