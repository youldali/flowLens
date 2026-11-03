import { ResultFlow } from '@youldali/result-flow';
import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract';
import { createFunctionExplainer, type AiApiError } from '@flowlens/code-insights';
import type { AIProvider } from '@flowlens/code-insights/domain/ai-provider';

export function createExplainFunction(
  getApiKey: (provider: AIProvider) => PromiseLike<string | undefined>,
  getProvider: () => AIProvider,
  createExplainer = createFunctionExplainer,
): ReturnType<typeof createFunctionExplainer> {
  return node => ResultFlow.gen<FunctionExplanation, AiApiError>(async function* ({ fail }) {
    let provider: AIProvider;
    let apiKey: string | undefined;

    try {
      provider = getProvider();
      apiKey = await getApiKey(provider);
    } catch {
      return fail({
        reason: 'generation-failed',
        cause: new Error('Could not load AI credentials.'),
        statusCode: undefined,
      });
    }

    return apiKey
      ? yield* createExplainer({ provider, apiKey })(node)
      : fail({ reason: 'missing-api-token', cause: undefined, statusCode: undefined });
  });
}
