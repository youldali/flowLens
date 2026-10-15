# Code insights

Shared code-insight capabilities for the CLI server and VS Code extension.
`buildFunctionExplanationPrompt(node)` accepts a `FunctionDeclarationNode` and
returns provider-independent `system` and `prompt` strings for explaining it.
The JSON input preserves the display name, source text, and optional JSDoc.
The prompt requests purpose, behavior, side effects, failure cases, and uncertainties.
`createFunctionExplanationGenerator({ model })` accepts a configured AI SDK model
object and returns `(node: FunctionDeclarationNode) => Promise<FunctionExplanation>`.
The caller owns provider selection and credentials; string model IDs are not accepted.

```ts
import { createFunctionExplanationGenerator } from '@flowlens/code-insights';

// model is a configured provider model; node is a validated function node.
const explainFunction = createFunctionExplanationGenerator({ model });
const explanation = await explainFunction(node);
```

Generation uses the existing prompt and SDK structured output validation. All five
fields are required, observation arrays may be empty, and extra fields are rejected.
Only the completed explanation is returned, without SDK metadata. Generation and
validation failures throw contextual errors preserving the original cause. SDK
generation settings and retries use their defaults. No streaming or fallback is added.

- `src/domain`: pure domain models and rules.
- `src/application`: use cases and ports for source retrieval and insight generation.
- `src/infrastructure`: port implementations, including Vercel AI SDK integrations.

Domain and application code must remain independent of the AI SDK, TypeScript AST,
HTTP, VS Code, and React. Hosts compose the use cases with infrastructure adapters.
The frontend module belongs in `code-analysis-context/code-insights`.
