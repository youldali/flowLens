import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APICallError, LoadAPIKeyError, RetryError } from 'ai';
import { toAiApiError } from './ai-api-adapter.js';

describe('toAiApiError', () => {
  it('preserves HTTP status for direct and wrapped API failures', () => {
    const apiError = new APICallError({
      message: 'Rate limited',
      url: 'https://provider.example/generate',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });
    const retryError = new RetryError({
      message: 'Retries exhausted',
      reason: 'maxRetriesExceeded',
      errors: [apiError, apiError, apiError],
    });

    for (const cause of [apiError, retryError]) {
      const error = toAiApiError(cause);
      assert.equal(error.cause, cause);
      assert.equal(error.reason, 'api-error');
      assert.equal(error.statusCode, 429);
    }
  });

  it('identifies missing credentials without inventing an HTTP status', () => {
    const cause = new LoadAPIKeyError({ message: 'API key missing' });
    const error = toAiApiError(cause);
    assert.equal(error.reason, 'missing-api-token');
    assert.equal(error.cause, cause);
    assert.equal(error.statusCode, undefined);
  });
});
