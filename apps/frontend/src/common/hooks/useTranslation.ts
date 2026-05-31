import {
  type i18n as nativeI18n,
  type TFunction,
} from 'i18next';
import {
  type FallbackNs,
  useTranslation as nativeUseTranslation,
} from 'react-i18next';

import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  type I18nNamespace,
  type Language,
} from '../i18n';
import { useDateFormatter } from './useDateFormatter';
import type codeAnalysisContextTranslations from '../../../public/locales/en/code-analysis-context.json';
import type commonTranslations from '../../../public/locales/en/common.json';

type TranslationsByNamespace = {
  common: typeof commonTranslations;
  'code-analysis-context': typeof codeAnalysisContextTranslations;
};
type DotPrefix<TPrefix extends string, TKey extends string> = TPrefix extends ''
  ? TKey
  : `${TPrefix}.${TKey}`;
type DotPath<TValue, TPrefix extends string = ''> = TValue extends string
  ? TPrefix
  : {
      [TKey in Extract<keyof TValue, string>]: DotPath<
        TValue[TKey],
        DotPrefix<TPrefix, TKey>
      >;
    }[Extract<keyof TValue, string>];

export type I18nKey<TNamespace extends I18nNamespace = typeof DEFAULT_NAMESPACE> =
  DotPath<TranslationsByNamespace[TNamespace]>;

export type I18nKey_COMMON = I18nKey<'common'>;
export type I18nKey_CODE_ANALYSIS_CONTEXT = I18nKey<'code-analysis-context'>;

type UseTranslationResult<TNamespace extends I18nNamespace> = {
  t: TFunction<FallbackNs<TNamespace>>;
  i18n: nativeI18n;
  activeLanguage: Language;
  localeFormat: ReturnType<typeof useDateFormatter>;
};

export const getActiveLanguage = (instance: nativeI18n): Language => {
  const language = instance.resolvedLanguage ?? instance.language;
  const normalizedLanguage = language?.split('-')[0];

  return normalizedLanguage === DEFAULT_LANGUAGE
    ? normalizedLanguage
    : DEFAULT_LANGUAGE;
};

export function useTranslation<
  const TNamespace extends I18nNamespace = typeof DEFAULT_NAMESPACE,
>(namespace?: TNamespace): UseTranslationResult<TNamespace> {
  const resolvedNamespace = namespace ?? (DEFAULT_NAMESPACE as TNamespace);
  const { t, i18n } = nativeUseTranslation<TNamespace>(resolvedNamespace);
  const activeLanguage = getActiveLanguage(i18n);
  const formatter = useDateFormatter(activeLanguage);

  return {
    t,
    i18n,
    activeLanguage,
    localeFormat: formatter,
  };
}
