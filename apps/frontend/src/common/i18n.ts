import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

import { getConfig } from './config';

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
export const COMMON_NAMESPACE = 'common';
export const CODE_ANALYSIS_CONTEXT_NAMESPACE = 'code-analysis-context';
export const DEFAULT_NAMESPACE = COMMON_NAMESPACE;
export const SUPPORTED_NAMESPACES = [
  DEFAULT_NAMESPACE,
  CODE_ANALYSIS_CONTEXT_NAMESPACE,
] as const;
export type I18nNamespace = (typeof SUPPORTED_NAMESPACES)[number];

void i18n.use(HttpBackend).use(initReactI18next).init({
  backend: {
    loadPath: getLocalesLoadPath(),
  },
  defaultNS: DEFAULT_NAMESPACE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  lng: DEFAULT_LANGUAGE,
  ns: SUPPORTED_NAMESPACES,
  react: {
    transSupportBasicHtmlNodes: true,
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'b'],
  },
  supportedLngs: SUPPORTED_LANGUAGES,
});

export { i18n };

function getLocalesLoadPath(): string {
  const { assetBaseUrl } = getConfig();

  return `${assetBaseUrl}/locales/{{lng}}/{{ns}}.json`;
}
