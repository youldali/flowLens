import { type ReactElement } from 'react';
import { type UseQueryResult } from 'react-query';

type QuerySuspenseProps<TResult, TError> = {
  queryState: UseQueryResult<TResult, TError>;
  fallback: (error: TError) => ReactElement | null;
  loading: ReactElement | null;
  idle?: ReactElement | null;
  children: (data: TResult) => ReactElement | null;
};

// TODO: naming is shitty, help me :D
export const QuerySuspense = <TResult, TError>({
  queryState,
  fallback,
  loading,
  idle,
  children,
}: QuerySuspenseProps<TResult, TError>) => {
  if (queryState.status === 'idle') {
    return idle ?? null;
  }
  if (queryState.status === 'loading') {
    return loading;
  }

  if (queryState.status === 'error') {
    return fallback(queryState.error);
  }

  return children(queryState.data);
};
