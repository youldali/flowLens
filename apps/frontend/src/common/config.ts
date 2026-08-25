import {
  detectRuntime,
  isVsCodeRuntimeWindow,
  type VsCodeRuntimeWindow,
} from './runtimeHost.ts'

export type VsCodeApi = VsCodeRuntimeWindow['__vscodeApi']

interface BaseConfig {
  apiBaseUrl: string
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
  const apiBaseUrl = getApiBaseUrl()
  const assetBaseUrl = getAssetBaseUrl()
  const runtimeHost = detectRuntime()

  if (typeof window !== 'undefined' && isVsCodeRuntimeWindow(window)) {
    return {
      apiBaseUrl,
      assetBaseUrl,
      runtimeHost: 'vscode',
      vscodeApi: window.__vscodeApi,
    }
  }

  return runtimeHost === 'cli'
    ? { apiBaseUrl, assetBaseUrl, runtimeHost }
    : { apiBaseUrl, assetBaseUrl, runtimeHost: 'web-app' }
}

function getApiBaseUrl(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}

function getAssetBaseUrl(): string {
  return typeof window === 'undefined' ? '' : window.__flowlensAssetBase ?? ''
}
