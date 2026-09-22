import { useContext } from 'react'

import type { Config } from './config'
import { ConfigContext } from './configContext'

export function useConfig(): Config {
  const config = useContext(ConfigContext)

  if (!config) {
    throw new Error('useConfig must be used inside ConfigProvider.')
  }

  return config
}
