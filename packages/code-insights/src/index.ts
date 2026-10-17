export { buildFunctionExplanationPrompt } from './infrastructure/prompts/function-explanation.js';
export { createFunctionExplanationGenerator } from './infrastructure/function-explanation-generator.js';
export type { FunctionExplanation } from '@domain/function-explanation.js';
export { toAiApiError, type AiApiError } from '@common/ai-api-adapter.js';
