import { ResultFlow } from '@youldali/result-flow';
import { err, ok } from 'neverthrow';
import { createFunctionExplainer, explainWithCodex, type AiApiError } from '@flowlens/code-insights';
import * as AiProviderDomain from '@flowlens/code-insights/domain/ai-provider';

export function createExplainFunction(
  getApiKey: (provider: AiProviderDomain.AIProvider) => PromiseLike<string | undefined>,
  getBackend: () => AiProviderDomain.AiBackend,
  createExplainer = createFunctionExplainer,
  explainCodex = explainWithCodex,
): ReturnType<typeof createFunctionExplainer> {
  return node => ResultFlow.from(() => ok(getBackend()))
    .catch(() => err({
      reason: 'generation-failed' as const,
      cause: new Error('Could not load AI backend.'),
      statusCode: undefined,
    }))
    .chain(backend => {
      if (backend === 'codex-cli') {
        return explainCodex(node).mapError((error): AiApiError => ({
          reason: error.reason === 'invalid-output' ? 'invalid-output' : 'generation-failed',
          cause: error,
          statusCode: undefined,
        }));
      }

      const provider = AiProviderDomain.getAiProvider(backend);
      return ResultFlow.from(async () => ok(await getApiKey(provider)))
        .catch(() => err({
          reason: 'generation-failed' as const,
          cause: new Error('Could not load AI credentials.'),
          statusCode: undefined,
        }))
        .chain(apiKey => apiKey
          ? createExplainer({ provider, apiKey })(node)
          : err({ reason: 'missing-api-token' as const, cause: undefined, statusCode: undefined }));
    });
}
