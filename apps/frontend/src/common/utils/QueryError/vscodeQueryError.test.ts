import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { isHttpQueryError } from './httpQueryError'
import { isQueryError } from './queryError'
import { isVsCodeQueryError, VsCodeQueryErrorClass } from './vscodeQueryError'

describe('VsCodeQueryErrorClass', () => {
  it('preserves diagnostics and arbitrary causes without serializing them', () => {
    for (const cause of [new Error('offline'), { message: 'bridge failed' }, 'unavailable']) {
      const error = new VsCodeQueryErrorClass({ reason: 'delivery-failed', operation: 'explain.node', requestId: 'request-1', cause })
      assert.ok(error instanceof Error)
      assert.ok(isQueryError(error))
      assert.ok(isVsCodeQueryError(error))
      assert.equal(isHttpQueryError(error), false)
      assert.equal(error.cause, cause)
      assert.equal(error.originalError, cause instanceof Error ? cause : undefined)
      assert.deepEqual(error.toJSON(), {
        name: 'VsCodeQueryError', message: 'VS Code request failure: explain.node, delivery-failed',
        transport: 'vscode', reason: 'delivery-failed', operation: 'explain.node', requestId: 'request-1',
      })
    }
  })
})

describe('isVsCodeQueryError', () => {
  it('rejects non-errors, ordinary errors and unsupported transports', () => {
    for (const value of [null, undefined, {}, { isQueryError: true, transport: 'vscode' }, new Error('plain'), Object.assign(new Error(), { isQueryError: true, transport: 'other' })]) {
      assert.equal(isQueryError(value), false)
      assert.equal(isVsCodeQueryError(value), false)
      assert.equal(isHttpQueryError(value), false)
    }
  })
})
