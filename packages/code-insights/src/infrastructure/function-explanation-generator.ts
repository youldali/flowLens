import type { FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import { generateText, Output, type LanguageModel } from 'ai';
import { toAiApiError, type AiApiError } from '@common/ai-api-adapter.js';
import { err, ok, type Result } from 'neverthrow';
import { functionExplanationSchema } from '@domain/function-explanation-contract.js';

import type { FunctionExplanation } from '@domain/function-explanation.js';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

export function createFunctionExplanationGenerator({ model }: {
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
