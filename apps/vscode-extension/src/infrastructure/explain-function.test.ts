import { ResultFlow } from '@youldali/result-flow';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { err, ok } from 'neverthrow';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { createFunctionDeclarationNode } from '@flowlens/analyzer-core/fixtures/node';
import type * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';
import { createExplainFunction } from './explain-function.js';

describe('createExplainFunction', () => {
  it('dispatches Codex without API credentials and adapts its failures to the event contract', async () => {
    const node = createFunctionDeclarationNode();
    const explanation = { purpose: 'Codex', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] };
    const explain = createExplainFunction(
      async () => assert.fail('Codex must not load an API key'),
      () => 'codex-cli',
      () => assert.fail('Codex must not create an API explainer'),
      received => {
        assert.equal(received, node);
        return ResultFlow.from(() => ok(explanation));
      },
    );
    const result = await explain(node).run();
    assertOk(result);
    assert.deepEqual(result.value, explanation);

    for (const reason of ['codex-not-available', 'invalid-output'] as const) {
      const failure = createExplainFunction(
        async () => assert.fail('Codex must not load an API key'),
        () => 'codex-cli',
        () => assert.fail('Codex must not create an API explainer'),
        () => ResultFlow.from(() => err({ reason, cause: undefined })),
      );
      const failed = await failure(node).run();
      assertErr(failed);
      assert.equal(failed.error.reason, reason === 'invalid-output' ? 'invalid-output' : 'generation-failed');
    }
  });

  it('retrieves current credentials per request and preserves generator results', async () => {
    let backend: AiProviderDomain.AiBackend = 'openai-api';
    const keys = new Map<AiProviderDomain.AIProvider, string>([['openai', 'first'], ['anthropic', 'second']]);
    const calls: { provider: AiProviderDomain.AIProvider; apiKey: string }[] = [];
    const result = ok({ purpose: 'Test', behavior: [], sideEffects: [], failureCases: [], uncertainties: [] });
    const node = createFunctionDeclarationNode();
    const explain = createExplainFunction(async selected => keys.get(selected), () => backend, options => {
      calls.push(options);
      return received => ResultFlow.gen(async function* () { assert.equal(received, node); return yield* result; });
    });
    const flow = explain(node);
    assert.deepEqual(calls, []);
    const explanationResult = await flow.run();
    assertOk(explanationResult);
    assert.equal(explanationResult.value, result.value);
    keys.set('openai', 'replacement');
    await flow.run();
    backend = 'claude-api';
    await flow.run();
    assert.deepEqual(calls, [
      { provider: 'openai', apiKey: 'first' },
      { provider: 'openai', apiKey: 'replacement' },
      { provider: 'anthropic', apiKey: 'second' },
    ]);
    keys.delete('anthropic');
    const missing = await explain(node).run();
    assertErr(missing);
    assert.equal(missing.error.reason, 'missing-api-token');
    assert.equal(calls.length, 3);
    const failure = err({ reason: 'api-error' as const, cause: undefined, statusCode: 401 });
    const failing = createExplainFunction(async () => 'key', () => backend, () => () => ResultFlow.from(failure));
    const failureResult = await failing(node).run();
    assertErr(failureResult);
    assert.equal(failureResult.error, failure.error);
  });

  it('sanitizes provider lookup failures without intercepting generation exceptions', async () => {
    const node = createFunctionDeclarationNode();
    const providerFailure = new Error('private provider details');
    const lookupFailure = createExplainFunction(
      async () => assert.fail('Must not load a key'),
      () => { throw providerFailure; },
      () => assert.fail('Must not generate'),
    );
    const result = await lookupFailure(node).run();
    assertErr(result);
    assert.equal(result.error.reason, 'generation-failed');
    assert.ok(result.error.cause instanceof Error);
    assert.equal(result.error.cause.message, 'Could not load AI backend.');

    const generationFailure = new Error('generation failed');

    for (const failureStage of ['creation', 'execution'] as const) {
      const explain = createExplainFunction(async () => 'key', () => 'openai-api', () => {
        if (failureStage === 'creation') throw generationFailure;
        return () => ResultFlow.gen(async function* () { throw generationFailure; });
      });

      await assert.rejects(explain(node).run(), error => error === generationFailure);
    }
  });

  it('avoids generation for missing keys and sanitizes retrieval failures', async () => {
    for (const get of [async () => undefined, async () => { throw new Error('sensitive-key'); }]) {
      const explain = createExplainFunction(get, () => 'openai-api', () => assert.fail('Must not generate'));
      const result = await explain(createFunctionDeclarationNode()).run();
      assertErr(result);
      assert.ok(['missing-api-token', 'generation-failed'].includes(result.error.reason));
      assert.equal(String(result.error.cause).includes('sensitive-key'), false);
    }
  });
});
