export { buildFunctionExplanationPrompt } from './infrastructure/prompts/function-explanation.js';
export { createFunctionExplainer } from './infrastructure/function-explanation-generator.js';
export type { FunctionExplanation } from '#domain/function-explanation';
export { toAiApiError, type AiApiError } from '#common/ai-api-adapter';
