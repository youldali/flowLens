# Code insights

Shared code-insight capabilities for the CLI server and VS Code extension.
`buildFunctionExplanationPrompt(node)` accepts a `FunctionDeclarationNode` and
returns provider-independent `system` and `prompt` strings for explaining it.
The JSON input preserves the display name, source text, and optional JSDoc.
The prompt requests purpose, behavior, side effects, failure cases, and uncertainties.
`createFunctionExplanationGenerator({ model })` accepts a configured AI SDK model
object and returns `(node: FunctionDeclarationNode) => Promise<Result<FunctionExplanation, AiApiError>>`.
The caller owns provider selection and credentials; string model IDs are not accepted.

```ts
import { createFunctionExplanationGenerator } from '@flowlens/code-insights';

// model is a configured provider model; node is a validated function node.
const explainFunction = createFunctionExplanationGenerator({ model });
const result = await explainFunction(node);
if (result.isErr()) {
  console.error(result.error.reason, result.error.statusCode, result.error.cause);
} else {
  console.log(result.value);
}
```

Generation uses the existing prompt and SDK structured output validation. All five
fields are required, observation arrays may be empty, and extra fields are rejected.
Successful results contain the completed explanation. Failures return a typed error
with the original `cause`, `statusCode` (`undefined` when unavailable), and a `reason`:
`api-error`, `invalid-output`, `missing-api-token`, or `generation-failed`. SDK
generation settings and retries use their defaults. No streaming or fallback is added.

- `src/common`: shared AI API error adaptation (`toAiApiError`).
- `src/domain`: pure domain models and rules.
- `src/application`: use cases and ports for source retrieval and insight generation.
- `src/infrastructure`: port implementations, including Vercel AI SDK integrations.

Domain and application code must remain independent of the AI SDK, TypeScript AST,
HTTP, VS Code, and React. Hosts compose the use cases with infrastructure adapters.
The frontend module belongs in `code-analysis-context/code-insights`.

The browser-safe `@flowlens/code-insights/domain/function-explanation-contract`
export provides `functionExplanationSchema` and the `FunctionExplanation` type
without importing the AI SDK. The generator and VS Code message registry share it.
