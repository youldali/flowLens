import { ResultFlow } from '@youldali/result-flow';
import { err, ok } from 'neverthrow';
import { createFunctionExplainer } from '@flowlens/code-insights';
import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';

export function createExplainFunction(
  getApiKey: (provider: AIProvider) => PromiseLike<string | undefined>,
  getProvider: () => AIProvider,
  createExplainer = createFunctionExplainer,
): ReturnType<typeof createFunctionExplainer> {
  return node => ResultFlow.from(async () => {
    const provider = getProvider();
    const apiKey = await getApiKey(provider);
    return ok({ provider, apiKey });
  })
    .catch(() => err({
      reason: 'generation-failed' as const,
      cause: new Error('Could not load AI credentials.'),
      statusCode: undefined,
    }))
    .chain(({ provider, apiKey }) => apiKey
      ? createExplainer({ provider, apiKey })(node)
      : err({ reason: 'missing-api-token' as const, cause: undefined, statusCode: undefined }));
}
