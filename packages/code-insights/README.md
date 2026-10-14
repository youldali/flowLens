# Code insights

Shared code-insight capabilities for the CLI server and VS Code extension.
This package is a scaffold; no use cases or provider integrations are implemented yet.

- `src/domain`: pure domain models and rules.
- `src/application`: use cases and ports for source retrieval and insight generation.
- `src/infrastructure`: port implementations, including Vercel AI SDK integrations.

Domain and application code must remain independent of the AI SDK, TypeScript AST,
HTTP, VS Code, and React. Hosts compose the use cases with infrastructure adapters.
The frontend module belongs in `code-analysis-context/code-insights`.
