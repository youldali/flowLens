import { useMemo } from 'react'

import { getConfig, type Config } from '../config'

export function useConfig(): Config {
  return useMemo(() => getConfig(), [])
}
