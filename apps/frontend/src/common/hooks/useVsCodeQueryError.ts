import { COMMON_NAMESPACE, type I18nNamespace } from '#common/i18n.ts'
import type { VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import { useTranslation, type I18nKey } from './useTranslation'

export type VsCodeTranslations<TReason extends string, TNamespace extends I18nNamespace = typeof COMMON_NAMESPACE> = {
  reason?: (reason: TReason) => I18nKey<TNamespace> | undefined
  getTranslationParams?: (reason: TReason) => Record<string, unknown>
}

export function useVsCodeQueryError<
  TReason extends string,
  TNamespace extends I18nNamespace = typeof COMMON_NAMESPACE,
>(
  translations: VsCodeTranslations<TReason, TNamespace>,
  options: { namespace?: TNamespace } = {},
) {
  const { t: tNamespace } = useTranslation(options.namespace ?? COMMON_NAMESPACE)
  const { t: tCommon } = useTranslation(COMMON_NAMESPACE)

  return (error: VsCodeQueryError<TReason>, params?: Record<string, unknown>): string => {
    const key = translations.reason?.(error.reason)
    const translationParams = translations.getTranslationParams?.(error.reason) ?? params

    return key
      ? (tNamespace as (key: string, options?: object) => string)(key, translationParams)
      : tCommon('misc.errors.unknownError', translationParams ?? {})
  }
}
