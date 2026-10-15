# Code insights

Shared code-insight capabilities for the CLI server and VS Code extension.
`buildFunctionExplanationPrompt(node)` accepts a `FunctionDeclarationNode` and
returns provider-independent `system` and `prompt` strings for explaining it.
The JSON input preserves the display name, source text, and optional JSDoc.
The prompt requests purpose, behavior, side effects, failure cases, and uncertainties.
Model invocation and response validation are not implemented yet; prompt instructions
alone do not guarantee valid JSON output.

- `src/domain`: pure domain models and rules.
- `src/application`: use cases and ports for source retrieval and insight generation.
- `src/infrastructure`: port implementations, including Vercel AI SDK integrations.

Domain and application code must remain independent of the AI SDK, TypeScript AST,
HTTP, VS Code, and React. Hosts compose the use cases with infrastructure adapters.
The frontend module belongs in `code-analysis-context/code-insights`.
