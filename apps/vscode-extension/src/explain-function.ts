import { createFunctionExplainer } from '@flowlens/code-insights';
import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';
import { err } from 'neverthrow';

export function createExplainFunction(
  getApiKey: (provider: AIProvider) => PromiseLike<string | undefined>,
  getProvider: () => AIProvider,
  createExplainer = createFunctionExplainer,
): ReturnType<typeof createFunctionExplainer> {
  return async node => {
    let provider: AIProvider;
    let apiKey: string | undefined;

    try {
      provider = getProvider();
      apiKey = await getApiKey(provider);
    } catch {
      return err({
        reason: 'generation-failed',
        cause: new Error('Could not load AI credentials.'),
        statusCode: undefined,
      });
    }

    return apiKey
      ? createExplainer({ provider, apiKey })(node)
      : err({ reason: 'missing-api-token', cause: undefined, statusCode: undefined });
  };
}
