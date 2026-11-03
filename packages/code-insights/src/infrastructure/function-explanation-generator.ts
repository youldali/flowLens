import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIProvider } from '#domain/ai-provider';
import type { FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import { generateText, Output, type LanguageModel } from 'ai';
import { toAiApiError, type AiApiError } from '#common/ai-api-adapter';
import { ResultFlow } from '@youldali/result-flow';
import { functionExplanationSchema } from '#domain/function-explanation-contract';

import type { FunctionExplanation } from '#domain/function-explanation';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

export function createFunctionExplainer({ provider, apiKey }: {
  provider: AIProvider;
  apiKey: string;
}): (node: FunctionDeclarationNode) => ResultFlow<FunctionExplanation, AiApiError> {
  const model = createAiModel(provider, apiKey);

  return createFunctionExplanationGenerator({ model });
}

function createAiModel(provider: AIProvider, apiKey: string): Exclude<LanguageModel, string> {
  return provider === 'openai'
    ? createOpenAI({ apiKey })('gpt-4.1-mini')
    : createAnthropic({ apiKey })('claude-sonnet-5-5');
}

function createFunctionExplanationGenerator({ model }: {
  model: Exclude<LanguageModel, string>;
}): (node: FunctionDeclarationNode) => ResultFlow<FunctionExplanation, AiApiError> {
  return node => ResultFlow.gen<FunctionExplanation, AiApiError>(async function* ({ fail }) {
    try {
      const { output } = await generateText({
        model,
        ...buildFunctionExplanationPrompt(node),
        output: Output.object({ schema: functionExplanationSchema }),
      });

      return output;
    } catch (cause) {
      return fail(toAiApiError(cause));
    }
  });
}
