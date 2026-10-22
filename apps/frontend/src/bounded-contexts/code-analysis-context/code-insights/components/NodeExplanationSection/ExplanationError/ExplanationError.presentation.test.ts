import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { getExplanationErrorPresentation } from './ExplanationError.presentation'

describe('getExplanationErrorPresentation', () => {
  it('maps every failure to its severity, copy and supported recovery', () => {
    const cases = [
      ['missing-api-token', 'info', 'configure-ai-provider'],
      ['graph-unavailable', 'warning', 'generate-graph'],
      ['stale-graph', 'warning', undefined],
      ['node-not-found', 'warning', undefined],
      ['node-not-explainable', 'info', undefined],
      ['api-error', 'error', 'retry'],
      ['invalid-output', 'error', 'retry'],
      ['generation-failed', 'error', 'retry'],
      ['delivery-failed', 'error', 'retry'],
    ] as const

    for (const [reason, severity, action] of cases) {
      const presentation = getExplanationErrorPresentation(reason)
      assert.equal(presentation?.severity, severity)
      assert.equal(presentation?.action, action)
      assert.equal(presentation?.title, `explanation.errors.${reason}`)
      assert.equal(presentation?.description, `explanation.descriptions.${reason}`)
    }

    assert.equal(getExplanationErrorPresentation('cancelled'), null)
  })

  it('uses controlled provider guidance for known statuses only', () => {
    for (const [status, detail] of [[401, 'authentication'], [403, 'permissions'], [429, 'rateLimit'], [503, 'unavailable']] as const) {
      assert.equal(getExplanationErrorPresentation('api-error', status)?.description, `explanation.providerDetails.${detail}`)
    }

    assert.equal(getExplanationErrorPresentation('api-error', 400)?.description, 'explanation.descriptions.api-error')
    assert.equal(getExplanationErrorPresentation('generation-failed', 401)?.description, 'explanation.descriptions.generation-failed')
  })

  it('offers retry after saving configuration only for a missing token', () => {
    assert.deepEqual(getExplanationErrorPresentation('missing-api-token', undefined, { configured: true }), {
      severity: 'info', title: 'explanation.configured', description: 'explanation.configuredDescription', action: 'retry',
    })
    assert.deepEqual(getExplanationErrorPresentation('api-error', 401, { configured: true }),
      getExplanationErrorPresentation('api-error', 401))
    assert.equal(getExplanationErrorPresentation('cancelled', undefined, { configured: true }), null)
  })

  it('overrides descriptions for recovery failures while preserving the error and action', () => {
    assert.deepEqual(getExplanationErrorPresentation('missing-api-token', undefined, { configurationFailed: true }), {
      ...getExplanationErrorPresentation('missing-api-token'), description: 'explanation.configurationFailed',
    })
    assert.deepEqual(getExplanationErrorPresentation('graph-unavailable', undefined, { generationFailed: true }), {
      ...getExplanationErrorPresentation('graph-unavailable'), description: 'explanation.graphDeliveryFailed',
    })
    assert.equal(getExplanationErrorPresentation('api-error', 401, {
      configurationFailed: true, generationFailed: true,
    })?.description, 'explanation.configurationFailed')
    assert.equal(getExplanationErrorPresentation('cancelled', undefined, { generationFailed: true }), null)
  })
})
