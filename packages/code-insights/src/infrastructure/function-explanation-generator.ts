import type { FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';

import type { FunctionExplanation } from '../domain/function-explanation.js';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

const functionExplanationSchema = z.strictObject({
  purpose: z.string(),
  behavior: z.array(z.string()),
  sideEffects: z.array(z.string()),
  failureCases: z.array(z.string()),
  uncertainties: z.array(z.string()),
}) satisfies z.ZodType<FunctionExplanation>;

export function createFunctionExplanationGenerator({ model }: {
  model: Exclude<LanguageModel, string>;
}): (node: FunctionDeclarationNode) => Promise<FunctionExplanation> {
  return async (node) => {
    try {
      const { output } = await generateText({
        model,
        ...buildFunctionExplanationPrompt(node),
        output: Output.object({ schema: functionExplanationSchema }),
      });

      return output;
    } catch (cause) {
      throw new Error(`Failed to generate explanation for function ${node.displayName}`, { cause });
    }
  };
}
