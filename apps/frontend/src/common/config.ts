import {
  detectRuntime,
  isVsCodeRuntimeWindow,
  type VsCodeRuntimeWindow,
} from './runtimeHost'

export type VsCodeApi = VsCodeRuntimeWindow['__vscodeApi']

interface BaseConfig {
  assetBaseUrl: string
}

export interface CliConfig extends BaseConfig {
  runtimeHost: 'cli'
}

export interface WebAppConfig extends BaseConfig {
  runtimeHost: 'web-app'
}

export interface VsCodeConfig extends BaseConfig {
  runtimeHost: 'vscode'
  vscodeApi: VsCodeApi
}

export type Config = CliConfig | WebAppConfig | VsCodeConfig

export function getConfig(): Config {
  const assetBaseUrl = getAssetBaseUrl()
  const runtimeHost = detectRuntime()

  if (typeof window !== 'undefined' && isVsCodeRuntimeWindow(window)) {
    return {
      assetBaseUrl,
      runtimeHost: 'vscode',
      vscodeApi: window.__vscodeApi,
    }
  }

  return runtimeHost === 'cli'
    ? { assetBaseUrl, runtimeHost }
    : { assetBaseUrl, runtimeHost: 'web-app' }
}

function getAssetBaseUrl(): string {
  return typeof window === 'undefined' ? '' : window.__flowlensAssetBase ?? ''
}
