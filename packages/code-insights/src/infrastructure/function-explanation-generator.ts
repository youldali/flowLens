import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIProvider } from '#domain/ai-provider';
import type { FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import { generateText, Output, type LanguageModel } from 'ai';
import { toAiApiError, type AiApiError } from '#common/ai-api-adapter';
import { err, ok, type Result } from 'neverthrow';
import { functionExplanationSchema } from '#domain/function-explanation-contract';

import type { FunctionExplanation } from '#domain/function-explanation';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

export function createFunctionExplainer({ provider, apiKey }: {
  provider: AIProvider;
  apiKey: string;
}): (node: FunctionDeclarationNode) => Promise<Result<FunctionExplanation, AiApiError>> {
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
}): (node: FunctionDeclarationNode) => Promise<Result<FunctionExplanation, AiApiError>> {
  return async (node) => {
    try {
      const { output } = await generateText({
        model,
        ...buildFunctionExplanationPrompt(node),
        output: Output.object({ schema: functionExplanationSchema }),
      });

      return ok(output);
    } catch (cause) {
      return err(toAiApiError(cause));
    }
  };
}
