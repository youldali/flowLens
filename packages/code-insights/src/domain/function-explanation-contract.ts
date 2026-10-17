import { z } from 'zod';
import type { FunctionExplanation } from './function-explanation.js';
export type { FunctionExplanation } from './function-explanation.js';

export const functionExplanationSchema = z.strictObject({
  purpose: z.string(),
  behavior: z.array(z.string()),
  sideEffects: z.array(z.string()),
  failureCases: z.array(z.string()),
  uncertainties: z.array(z.string()),
}) satisfies z.ZodType<FunctionExplanation>;

