import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { fromFetchError, isHttpQueryError, isRequestError } from './httpQueryError'
import { isQueryError } from './queryError'

const request = new Request('https://flowlens.test/graph.json')

describe('fromFetchError', () => {
  it('preserves HTTP classification, diagnostics and already normalized errors', async () => {
    for (const [status, type] of [[400, 'RequestError'], [498, 'RequestError'], [499, 'ServerError'], [500, 'ServerError']] as const) {
      const error = await fromFetchError<{ reason: string }>(request, Response.json({ reason: 'failure' }, { status }))
      assert.equal(error.type, type)
      assert.equal(error.transport, 'http')
      assert.equal(error.url, request.url)
      assert.equal(error.method, 'GET')
      assert.ok(isHttpQueryError(error))
      assert.ok(isQueryError(error))
      assert.equal(await fromFetchError(request, error), error)
      if (isRequestError(error)) assert.deepEqual(error.data, { reason: 'failure' })
      assert.equal((error.toJSON() as { transport: string }).transport, 'http')
    }
    const cause = new Error('offline')
    const error = await fromFetchError(request, cause)
    assert.equal(error.type, 'NetworkError')
    assert.equal(error.originalError, cause)
    assert.equal('originalError' in error.toJSON(), false)
    assert.equal((await fromFetchError(request, Response.error())).type, 'NetworkError')
  })
})
