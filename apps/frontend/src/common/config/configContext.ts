import { createContext } from 'react'

import type { Config } from './config'

export const ConfigContext = createContext<Config | undefined>(undefined)
