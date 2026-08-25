import { createContext, useContext } from 'react'

export type RuntimeHost = 'cli' | 'vscode' | 'web-app'

declare global {
  interface Window {
    __flowlensHost?: RuntimeHost
    __flowlensAssetBase?: string
  }
}

export type VsCodeRuntimeWindow = Window & {
  __flowlensHost: 'vscode'
  __flowlensAssetBase: string
  __vscodeApi: {
    postMessage(message: unknown): void
  }
}

export type RuntimeHostContextValue = {
  runtimeHost: RuntimeHost
}

export const RuntimeHostContext = createContext<RuntimeHostContextValue | undefined>(undefined)

export function detectRuntime(): RuntimeHost {
  if (typeof window === 'undefined') {
    // Non-browser execution cannot inspect host globals, so use the default frontend runtime.
    return 'web-app'
  }

  if (isVsCodeRuntimeWindow(window)) {
    return 'vscode'
  }

  return isRuntimeHost(window.__flowlensHost) ? window.__flowlensHost : 'web-app'
}

export function isVsCodeRuntimeWindow(value: Window): value is VsCodeRuntimeWindow {
  if (value.__flowlensHost === 'vscode' && !hasVsCodeRuntimeShape(value)) {
    throw new Error('VS Code runtime window is missing expected FlowLens globals.')
  }

  return value.__flowlensHost === 'vscode'
}

function isRuntimeHost(value: unknown): value is RuntimeHost {
  return value === 'cli' || value === 'vscode' || value === 'web-app'
}

function hasVsCodeRuntimeShape(value: Window): value is VsCodeRuntimeWindow {
  return (
    typeof value.__flowlensAssetBase === 'string'
    && '__vscodeApi' in value
    && typeof value.__vscodeApi === 'object'
    && value.__vscodeApi !== null
    && 'postMessage' in value.__vscodeApi
    && typeof value.__vscodeApi.postMessage === 'function'
  )
}

export function useRuntimeHost(): RuntimeHost {
  const context = useContext(RuntimeHostContext)

  if (!context) {
    throw new Error('useRuntimeHost must be used inside RuntimeHostProvider.')
  }

  return context.runtimeHost
}
