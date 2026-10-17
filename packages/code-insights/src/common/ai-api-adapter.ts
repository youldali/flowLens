import { APICallError, LoadAPIKeyError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError } from 'ai';

export type AiApiError = {
  reason: 'api-error' | 'invalid-output' | 'missing-api-token' | 'generation-failed';
  cause: unknown;
  statusCode: number | undefined;
};

export function toAiApiError(cause: unknown): AiApiError {
  const failure = RetryError.isInstance(cause) ? cause.lastError : cause;

  if (APICallError.isInstance(failure)) {
    return { cause, reason: 'api-error', statusCode: failure.statusCode };
  }

  return {
    cause,
    reason: LoadAPIKeyError.isInstance(failure)
      ? 'missing-api-token'
      : NoObjectGeneratedError.isInstance(failure) || NoOutputGeneratedError.isInstance(failure)
        ? 'invalid-output'
        : 'generation-failed',
    statusCode: undefined,
  };
}
