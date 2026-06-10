import { createContext, useContext } from 'react'

export type RuntimeHost = 'cli' | 'vscode' | 'web-app'

declare global {
  interface Window {
    __flowlensHost?: RuntimeHost
  }
}

export type RuntimeHostContextValue = {
  runtimeHost: RuntimeHost
}

export const RuntimeHostContext = createContext<RuntimeHostContextValue | undefined>(undefined)

export function detectRuntime(): RuntimeHost {
  if (typeof window === 'undefined') {
    return 'web-app'
  }

  if ('__vscodeApi' in window) {
    return 'vscode'
  }

  return isRuntimeHost(window.__flowlensHost) ? window.__flowlensHost : 'web-app'
}

function isRuntimeHost(value: unknown): value is RuntimeHost {
  return value === 'cli' || value === 'vscode' || value === 'web-app'
}

export function useRuntimeHost(): RuntimeHost {
  const context = useContext(RuntimeHostContext)

  if (!context) {
    throw new Error('useRuntimeHost must be used inside RuntimeHostProvider.')
  }

  return context.runtimeHost
}
