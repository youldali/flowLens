import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as AiProviderDomain from './ai-provider.js'

describe('getAiProvider', () => {
  it('identifies OpenAI as the provider for both OpenAI API and Codex CLI', () => {
    assert.equal(AiProviderDomain.getAiProvider('openai-api'), 'openai')
    assert.equal(AiProviderDomain.getAiProvider('claude-api'), 'anthropic')
    assert.equal(AiProviderDomain.getAiProvider('codex-cli'), 'openai')
  })
})

describe('isApiKeyRequired', () => {
  it('requires a key for API backends but not for Codex CLI', () => {
    assert.equal(AiProviderDomain.isApiKeyRequired('openai-api'), true)
    assert.equal(AiProviderDomain.isApiKeyRequired('claude-api'), true)
    assert.equal(AiProviderDomain.isApiKeyRequired('codex-cli'), false)
  })
})
