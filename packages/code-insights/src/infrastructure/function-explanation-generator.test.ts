import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { createFunctionExplainer } from './function-explanation-generator.js';
import { create as createExplanation } from '../fixtures/function-explanation.js';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

describe('createFunctionExplainer', () => {
  it('sends the source prompt and validates generated explanations', async context => {
    const explanation = createExplanation();
    const { purpose: _purpose, ...missingPurpose } = explanation;
    const node = createFunctionDeclarationNode();
    const prompt = buildFunctionExplanationPrompt(node);
    let text = '';
    context.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      assert.equal(body.system[0].text, prompt.system);
      assert.equal(body.messages[0].content[0].text, prompt.prompt);

      return new Response(JSON.stringify({
        id: 'message', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
      }), { headers: { 'content-type': 'application/json' } });
    });
    const explain = createFunctionExplainer({ provider: 'anthropic', apiKey: 'test-key' });

    for (const value of [explanation, createExplanation({ behavior: [], uncertainties: [] })]) {
      text = JSON.stringify(value);
      const result = await explain(node);

      assertOk(result);
      assert.deepEqual(result.value, value);
    }

    for (const invalid of ['not JSON', JSON.stringify(missingPurpose), JSON.stringify({ ...explanation, behavior: [42] }), JSON.stringify({ ...explanation, extra: true })]) {
      text = invalid;
      const result = await explain(node);

      assertErr(result);
      assert.equal(result.error.reason, 'invalid-output');
      assert.ok(result.error.cause);
    }
  });

  for (const [provider, modelId, hostname, header, credential] of [
    ['openai', 'gpt-4.1-mini', 'api.openai.com', 'authorization', 'Bearer flowlens-placeholder-api-key'],
    ['anthropic', 'claude-sonnet-5-5', 'api.anthropic.com', 'x-api-key', 'flowlens-placeholder-api-key'],
  ] as const) {
    it(`configures ${provider} with its fixed model and placeholder key`, async context => {
      const requests: { url: string; headers: Headers; body: string }[] = [];
      context.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
        requests.push({ url: String(url), headers: new Headers(init.headers), body: String(init.body) });

        return new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'Invalid API key' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      });
      const explain = createFunctionExplainer({ provider, apiKey: 'flowlens-placeholder-api-key' });
      const result = await explain(createFunctionDeclarationNode());

      assertErr(result);
      assert.equal(result.error.reason, 'api-error');
      assert.equal(requests.length, 1);
      const request = requests[0]!;

      assert.equal(new URL(request.url).hostname, hostname);
      assert.equal(request.headers.get(header), credential);
      assert.equal(JSON.parse(request.body).model, modelId);
    });
  }
});
