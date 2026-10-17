import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node';
import { NoObjectGeneratedError } from 'ai';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { MockLanguageModelV4 } from 'ai/test';

import { create as createExplanation } from '../fixtures/function-explanation.js';
import { createFunctionExplanationGenerator } from './function-explanation-generator.js';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

describe('createFunctionExplanationGenerator', () => {
  it('returns the validated explanation and sends the existing prompt to the model', async () => {
    const explanation = createExplanation();
    const model = createModel(JSON.stringify(explanation));
    const node = createFunctionDeclarationNode();
    const prompt = buildFunctionExplanationPrompt(node);
    const generate = createFunctionExplanationGenerator({ model });

    const result = await generate(node);

    assertOk(result);
    assert.deepEqual(result.value, explanation);
    assert.equal(model.doGenerateCalls.length, 1);
    assert.deepEqual(model.doGenerateCalls[0]?.prompt.map(({ role, content }) => ({ role, content })), [
      { role: 'system', content: prompt.system },
      { role: 'user', content: [{ type: 'text', text: prompt.prompt }] },
    ]);
  });

  it('accepts empty arrays for every observation field', async () => {
    const explanation = createExplanation({ behavior: [], uncertainties: [] });
    const generate = createFunctionExplanationGenerator({ model: createModel(JSON.stringify(explanation)) });

    const result = await generate(createFunctionDeclarationNode());

    assertOk(result);
    assert.deepEqual(result.value, explanation);
  });

  it('rejects malformed JSON, missing fields, wrong types, and additional fields', async () => {
    const explanation = createExplanation();
    const { purpose: _purpose, ...missingPurpose } = explanation;
    const invalidResponses = [
      'not JSON',
      JSON.stringify(missingPurpose),
      JSON.stringify({ ...explanation, behavior: [42] }),
      JSON.stringify({ ...explanation, extra: 'unexpected' }),
    ];

    for (const response of invalidResponses) {
      const generate = createFunctionExplanationGenerator({ model: createModel(response) });

      const result = await generate(createFunctionDeclarationNode());

      assertErr(result);
      assert.equal(result.error.reason, 'invalid-output');
      assert.equal(result.error.statusCode, undefined);
      assert.ok(NoObjectGeneratedError.isInstance(result.error.cause));
    }
  });

  it('preserves the cause when the provider fails', async () => {
    const cause = new Error('Provider unavailable');
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw cause; } });
    const generate = createFunctionExplanationGenerator({ model });

    const node = createFunctionDeclarationNode();
    const result = await generate(node);

    assertErr(result);
    assert.equal(result.error.cause, cause);
    assert.equal(result.error.reason, 'generation-failed');
    assert.equal(result.error.statusCode, undefined);
  });
});

function createModel(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}
