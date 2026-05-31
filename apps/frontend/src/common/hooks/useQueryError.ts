import { type HttpStatusCode, type QueryError } from '@common/utils/queryError';
import {
  type I18nKey,
  useTranslation,
} from '@common/hooks/useTranslation';
import {
  COMMON_NAMESPACE,
  type I18nNamespace,
} from '@common/i18n';

export type Translations<
  TError,
  TNamespace extends I18nNamespace = typeof COMMON_NAMESPACE,
> = {
  serverError?: I18nKey<TNamespace>;
  networkError?: I18nKey<TNamespace>;
  requestError?: (
    reason: TError,
    httpStatusCode: HttpStatusCode,
  ) => I18nKey<TNamespace> | undefined;
  getTranslationParams?: (error: TError) => Record<string, unknown>;
};

type UseQueryErrorOptions<TNamespace extends I18nNamespace> = {
  namespace?: TNamespace;
};

type CommonTranslationKey = {
  namespace: typeof COMMON_NAMESPACE;
  key: I18nKey<typeof COMMON_NAMESPACE>;
};

type ResolvedTranslationKey<TNamespace extends I18nNamespace> =
  | {
      namespace: TNamespace;
      key: I18nKey<TNamespace>;
    }
  | CommonTranslationKey;

type Translate = (key: string, options?: object) => string;

export const useQueryError = <
  TError,
  TParams extends object = Record<string, unknown>,
  TNamespace extends I18nNamespace = typeof COMMON_NAMESPACE,
>(
  translations: Translations<TError, TNamespace>,
  options: UseQueryErrorOptions<TNamespace> = {},
) => {
  const namespace = options.namespace ?? COMMON_NAMESPACE;
  const { t: tNamespace } = useTranslation(namespace);
  const { t: tCommon } = useTranslation(COMMON_NAMESPACE);

  return (
    queryError: QueryError<TError>,
    translationsParams?: TParams,
  ): string => {
    const translationKey = getErrorTitle({
      namespace,
      queryError,
      translations,
    });
    const translationParams =
      getTranslationParams({ queryError, translations }) ?? translationsParams;
    const translate = (
      translationKey.namespace === COMMON_NAMESPACE ? tCommon : tNamespace
    ) as Translate;

    return translationParams
      ? translate(translationKey.key, translationParams)
      : translate(translationKey.key);
  };
};

const getTranslationParams = <TError>({
  queryError,
  translations,
}: {
  queryError: QueryError<TError>;
  translations: Translations<TError, I18nNamespace>;
}) => {
  return queryError.type === 'RequestError'
    ? translations.getTranslationParams?.(queryError.data)
    : undefined;
};

const createNamespacedKey = <TNamespace extends I18nNamespace>(
  namespace: TNamespace,
  key: I18nKey<TNamespace>,
): ResolvedTranslationKey<TNamespace> => ({
  namespace,
  key,
});

const createCommonKey = (
  key: I18nKey<typeof COMMON_NAMESPACE>,
): CommonTranslationKey => ({
  namespace: COMMON_NAMESPACE,
  key,
});

const getErrorTitle = <
  TError,
  TNamespace extends I18nNamespace,
>({
  namespace,
  queryError,
  translations,
}: {
  namespace: TNamespace;
  queryError: QueryError<TError>;
  translations: Translations<TError, TNamespace>;
}): ResolvedTranslationKey<TNamespace> => {
  switch (queryError.type) {
    case 'NetworkError':
      return translations.networkError
        ? createNamespacedKey(namespace, translations.networkError)
        : createCommonKey('misc.errors.networkError');
    case 'RequestError': {
      const requestErrorKey = translations.requestError?.(
        queryError.data,
        queryError.status,
      );

      return requestErrorKey
        ? createNamespacedKey(namespace, requestErrorKey)
        : getErrorTitleFromHttpStatus(queryError.status) ??
            createCommonKey('misc.errors.unknownError');
    }
    case 'ServerError':
      return translations.serverError
        ? createNamespacedKey(namespace, translations.serverError)
        : createCommonKey('misc.errors.serverError');
    default:
      return createCommonKey('misc.errors.unknownError');
  }
};

const getErrorTitleFromHttpStatus = (
  httpStatusCode: HttpStatusCode,
): CommonTranslationKey | undefined => {
  switch (httpStatusCode) {
    case 400:
      return createCommonKey('misc.errors.requestErrors.badRequest');
    case 401:
      return createCommonKey('misc.errors.requestErrors.unauthorized');
    case 403:
      return createCommonKey('misc.errors.requestErrors.forbidden');
    case 404:
      return createCommonKey('misc.errors.requestErrors.notFound');
    case 408:
      return createCommonKey('misc.errors.requestErrors.timeout');
    case 413:
      return createCommonKey('misc.errors.requestErrors.payloadTooLarge');
    case 415:
      return createCommonKey('misc.errors.requestErrors.unsupportedMediaType');
    case 429:
      return createCommonKey('misc.errors.requestErrors.tooManyRequests');
    default:
      return undefined;
  }
};
