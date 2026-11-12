export { buildFunctionExplanationPrompt } from '#infrastructure/prompts/function-explanation';
export { createFunctionExplainer } from '#infrastructure/function-explanation-generator';
export { explainWithCodex, type CodexCliError } from '#infrastructure/codex-function-explainer';
export type { FunctionExplanation } from '#domain/function-explanation';
export { toAiApiError, type AiApiError } from '#common/ai-api-adapter';
