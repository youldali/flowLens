// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { customQueryRequestErrorFactory, fromFetchError, VsCodeQueryErrorClass, type HttpQueryError } from '#common/utils/QueryError/index.ts'
import { useQueryError, type UseQueryErrorOptions } from './useQueryError'

vi.mock('./useTranslation', () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string, params?: object) => JSON.stringify({ namespace, key, params }),
  }),
}))
afterEach(cleanup)

const request = new Request('https://flowlens.test/graph.json')
const vscodeError = new VsCodeQueryErrorClass({ reason: 'api-error', operation: 'explain.node' })
const requestError = customQueryRequestErrorFactory({ data: { reason: 'missing' }, status: 404, url: request.url, method: 'GET' })

describe('useQueryError', () => {
  it('handles absent errors and delegates across transport changes without changing hook order', () => {
    type Options = UseQueryErrorOptions<{ reason: string }, 'api-error', 'code-analysis-context'>
    const { result, rerender } = renderHook((options: Options) => useQueryError(options), {
      initialProps: { error: null, httpTranslations: {} } as Options,
    })
    assert.equal(result.current, undefined)
    rerender({ error: requestError, httpTranslations: {} })
    assert.deepEqual(JSON.parse(result.current!), { namespace: 'common', key: 'misc.errors.requestErrors.notFound' })
    rerender({ error: vscodeError, namespace: 'code-analysis-context', vscodeTranslations: { reason: reason => `explanation.errors.${reason}` } })
    assert.deepEqual(JSON.parse(result.current!), { namespace: 'code-analysis-context', key: 'explanation.errors.api-error' })
    rerender({ error: undefined, vscodeTranslations: {} })
    assert.equal(result.current, undefined)
  })

  it('preserves HTTP callbacks, status and interpolation precedence', () => {
    const { result } = renderHook(() => useQueryError({
      error: requestError,
      namespace: 'code-analysis-context',
      translationParams: { source: 'explicit' },
      httpTranslations: {
        requestError: (data, status) => {
          assert.equal(data.reason, 'missing')
          assert.equal(status, 404)
          return 'explanation.errors.node-not-found'
        },
        getTranslationParams: data => ({ source: data.reason }),
      },
    }))
    assert.deepEqual(JSON.parse(result.current!), {
      namespace: 'code-analysis-context', key: 'explanation.errors.node-not-found', params: { source: 'missing' },
    })
  })

  it('preserves HTTP category and status fallbacks and overrides', async () => {
    for (const [failure, key] of [
      [new Error('offline'), 'misc.errors.networkError'],
      [new Response(null, { status: 500 }), 'misc.errors.serverError'],
      [Response.json({}, { status: 401 }), 'misc.errors.requestErrors.unauthorized'],
      [Response.json({}, { status: 418 }), 'misc.errors.unknownError'],
    ] as const) {
      const error = await fromFetchError(request, failure)
      const { result, unmount } = renderHook(() => useQueryError({ error, httpTranslations: {} }))
      assert.equal(JSON.parse(result.current!).key, key)
      unmount()
      const overridden = renderHook(() => useQueryError({
        error,
        httpTranslations: { networkError: 'misc.errors.unknownError', serverError: 'misc.errors.unknownError' },
      }))
      if (error.type !== 'RequestError') assert.equal(JSON.parse(overridden.result.current!).key, 'misc.errors.unknownError')
      overridden.unmount()
    }
  })

  it('falls back for unmapped VS Code reasons and prefers callback interpolation', () => {
    const { result } = renderHook(() => useQueryError({
      error: vscodeError,
      translationParams: { source: 'explicit' },
      vscodeTranslations: { reason: () => undefined, getTranslationParams: reason => ({ source: reason }) },
    }))
    assert.deepEqual(JSON.parse(result.current!), {
      namespace: 'common', key: 'misc.errors.unknownError', params: { source: 'api-error' },
    })
    const explicit = renderHook(() => useQueryError({ error: vscodeError, vscodeTranslations: {}, translationParams: { source: 'explicit' } }))
    assert.deepEqual(JSON.parse(explicit.result.current!).params, { source: 'explicit' })
  })
})

// Compiled, but never rendered: these calls verify the public type contract.
export function QueryErrorTypeChecks({ http }: { http: HttpQueryError<{ reason: string }> }) {
  // @ts-expect-error HTTP errors cannot use VS Code translations.
  useQueryError({ error: http, vscodeTranslations: {} })
  // @ts-expect-error VS Code errors cannot use HTTP translations.
  useQueryError({ error: vscodeError, httpTranslations: {} })
  // @ts-expect-error Both transport configurations cannot be supplied together.
  useQueryError({ error: vscodeError, httpTranslations: {}, vscodeTranslations: {} })
  useQueryError({ error: vscodeError, vscodeTranslations: {
    // @ts-expect-error Translation keys must exist in the selected namespace.
    reason: () => 'explanation.errors.api-error',
  } })
  // @ts-expect-error The callback reason must match the supplied error.
  useQueryError({ error: vscodeError, namespace: 'code-analysis-context', vscodeTranslations: {
    reason: (reason: 'delivery-failed') => `explanation.errors.${reason}`,
  } })
  return null
}
