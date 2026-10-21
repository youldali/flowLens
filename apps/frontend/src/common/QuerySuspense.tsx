import { type ReactElement } from 'react';
import { type UseQueryResult } from 'react-query';

type QuerySuspenseProps<TResult, TError> = {
  queryState: UseQueryResult<TResult, TError>;
  fallback: (error: TError) => ReactElement | null;
  loading: ReactElement | null;
  refetching?: ReactElement | null;
  idle?: ReactElement | null;
  keepDataOnError?: boolean;
  children: (data: TResult) => ReactElement | null;
};

export const QuerySuspense = <TResult, TError>({
  queryState,
  fallback,
  loading,
  refetching = null,
  idle,
  keepDataOnError = false,
  children,
}: QuerySuspenseProps<TResult, TError>) => {
  if (queryState.status === 'idle') {
    return idle ?? null;
  }
  if (queryState.status === 'loading') {
    return loading;
  }

  if (queryState.isFetching) {
    return <>{refetching}{queryState.data !== undefined && children(queryState.data)}</>;
  }

  if (queryState.status === 'error') {
    return keepDataOnError && queryState.data !== undefined
      ? <>{fallback(queryState.error)}{children(queryState.data)}</>
      : fallback(queryState.error);
  }

  return children(queryState.data);
};
