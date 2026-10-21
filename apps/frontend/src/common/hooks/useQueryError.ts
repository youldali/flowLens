import { COMMON_NAMESPACE, type I18nNamespace } from '#common/i18n.ts'
import { isHttpQueryError, type HttpQueryError, type VsCodeQueryError } from '#common/utils/QueryError/index.ts'
import { useHttpQueryError, type HttpTranslations } from './useHttpQueryError'
import { useVsCodeQueryError, type VsCodeTranslations } from './useVsCodeQueryError'

export type UseQueryErrorOptions<THttpData, TReason extends string, TNamespace extends I18nNamespace> = {
  namespace?: TNamespace
  translationParams?: Record<string, unknown>
} & (
  | {
    error: HttpQueryError<THttpData> | null | undefined
    httpTranslations: HttpTranslations<THttpData, TNamespace>
    vscodeTranslations?: never
  }
  | {
    error: VsCodeQueryError<TReason> | null | undefined
    vscodeTranslations: VsCodeTranslations<TReason, TNamespace>
    httpTranslations?: never
  }
)

export function useQueryError<
  THttpData = unknown,
  TReason extends string = string,
  TNamespace extends I18nNamespace = typeof COMMON_NAMESPACE,
>(options: UseQueryErrorOptions<THttpData, TReason, TNamespace>): string | undefined {
  const namespace = options.namespace ?? (COMMON_NAMESPACE as TNamespace)
  const formatHttpError = useHttpQueryError(options.httpTranslations ?? {}, { namespace })
  const formatVsCodeError = useVsCodeQueryError(options.vscodeTranslations ?? {}, { namespace })

  if (!options.error) return undefined

  return isHttpQueryError<THttpData>(options.error)
    ? formatHttpError(options.error, options.translationParams)
    : formatVsCodeError(options.error, options.translationParams)
}
