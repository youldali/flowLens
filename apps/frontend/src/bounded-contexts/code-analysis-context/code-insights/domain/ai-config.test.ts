import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import * as AiConfigDomain from './ai-config'

describe('getAiProvider', () => {
  it('identifies OpenAI as the provider for both OpenAI API and Codex CLI', () => {
    assert.equal(AiConfigDomain.getAiProvider('openai-api'), 'openai')
    assert.equal(AiConfigDomain.getAiProvider('claude-api'), 'anthropic')
    assert.equal(AiConfigDomain.getAiProvider('codex-cli'), 'openai')
  })
})

describe('isApiKeyRequired', () => {
  it('requires a key for API backends but not for Codex CLI', () => {
    assert.equal(AiConfigDomain.isApiKeyRequired('openai-api'), true)
    assert.equal(AiConfigDomain.isApiKeyRequired('claude-api'), true)
    assert.equal(AiConfigDomain.isApiKeyRequired('codex-cli'), false)
  })
})
