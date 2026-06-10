import type { ReactNode } from 'react'

import { detectRuntime, RuntimeHostContext, type RuntimeHost } from './runtimeHost'

type RuntimeHostProviderProps = {
  children: ReactNode
  runtimeHost?: RuntimeHost
}

export function RuntimeHostProvider({
  children,
  runtimeHost = detectRuntime(),
}: RuntimeHostProviderProps) {
  return (
    <RuntimeHostContext.Provider value={{ runtimeHost }}>
      {children}
    </RuntimeHostContext.Provider>
  )
}
