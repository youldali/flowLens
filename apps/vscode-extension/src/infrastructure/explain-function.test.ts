import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { err, ok } from 'neverthrow';
import { assertErr } from '@flowlens/common/testing';
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node';
import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import { createExplainFunction } from './explain-function.js';

describe('createExplainFunction', () => {
  it('retrieves current credentials per request and preserves generator results', async () => {
    let provider: AIProvider = 'openai';
    const keys = new Map<AIProvider, string>([['openai', 'first'], ['anthropic', 'second']]);
    const calls: { provider: AIProvider; apiKey: string }[] = [];
    const result = ok({ purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] });
    const node = createFunctionDeclarationNode();
    const explain = createExplainFunction(async selected => keys.get(selected), () => provider, options => {
      calls.push(options);
      return async received => { assert.equal(received, node); return result; };
    });
    assert.equal(await explain(node), result);
    keys.set('openai', 'replacement');
    await explain(node);
    provider = 'anthropic';
    await explain(node);
    assert.deepEqual(calls, [
      { provider: 'openai', apiKey: 'first' },
      { provider: 'openai', apiKey: 'replacement' },
      { provider: 'anthropic', apiKey: 'second' },
    ]);
    keys.delete(provider);
    const missing = await explain(node);
    assertErr(missing);
    assert.equal(missing.error.reason, 'missing-api-token');
    assert.equal(calls.length, 3);
    const failure = err({ reason: 'api-error' as const, cause: undefined, statusCode: 401 });
    const failing = createExplainFunction(async () => 'key', () => provider, () => async () => failure);
    assert.equal(await failing(node), failure);
  });

  it('avoids generation for missing keys and sanitizes retrieval failures', async () => {
    for (const get of [async () => undefined, async () => { throw new Error('sensitive-key'); }]) {
      const explain = createExplainFunction(get, () => 'openai', () => assert.fail('Must not generate'));
      const result = await explain(createFunctionDeclarationNode());
      assertErr(result);
      assert.ok(['missing-api-token', 'generation-failed'].includes(result.error.reason));
      assert.equal(String(result.error.cause).includes('sensitive-key'), false);
    }
  });
});
