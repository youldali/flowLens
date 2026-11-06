# Code insights

Shared code-insight capabilities for the CLI server and VS Code extension.
`buildFunctionExplanationPrompt(node)` accepts a `FunctionDeclarationNode` and
returns provider-independent `system` and `prompt` strings for explaining it.
The JSON input preserves the display name, source text, and optional JSDoc.
The prompt requests purpose, behavior, side effects, failure cases, and uncertainties.
An optional second argument, `{ repositoryContext: { workspaceDirectory, filePath } }`,
adds source location metadata and read-only repository inspection instructions.
The Codex adapter supplies resolved paths; callers without repository access omit it.
`createFunctionExplainer({ provider, apiKey })` accepts a provider and API key and returns `(node: FunctionDeclarationNode) => ResultFlow<FunctionExplanation, AiApiError>`. Execute the lazy flow with `await explain(node).run()` or compose it with `yield* explain(node)` in `ResultFlow.gen`.
The caller owns provider selection and credentials. Model construction and generation are private implementation details. OpenAI uses `gpt-4.1-mini`; Anthropic uses `claude-sonnet-5-5`.

```ts
import { createFunctionExplainer } from '@flowlens/code-insights';

// apiKey is supplied by the host; node is a validated function node.
const explainFunction = createFunctionExplainer({ provider: 'openai', apiKey });
const result = await explainFunction(node).run();
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

## Local Codex CLI

`src/infrastructure/codex-cli.ts` owns reusable read-only Codex process execution,
cancellation, process-tree termination, and diagnostic handling. Its `runCodex`
function accepts workspace, prompt, schema and output paths, and an optional abort
signal. The function explanation provider supplies these inputs and owns its
timeout policy, temporary files, and response validation.

`explainWithCodex(node, options?: { timeoutMs?: number })` returns
`ResultFlow<FunctionExplanation, CodexCliError>`. This Node-only provider uses the
locally installed `codex` executable and its existing authentication; it does not
require an API key or change the existing API providers.

```ts
import { explainWithCodex } from '@flowlens/code-insights';

const result = await explainWithCodex(node).run({ abortSignal });
```

Each execution discovers the workspace from `node.filePath`, supplies the node's
source snapshot and offsets, and lets Codex inspect related files. Invocation uses
`codex exec --sandbox read-only --ephemeral --config 'approval_policy="never"'`
with `--cd`, `--skip-git-repo-check`, `--output-schema`, and
`--output-last-message`. Arguments are passed without a shell; the prompt travels
over stdin. The package build generates `dist/infrastructure/function-explanation.schema.json`
from the existing Zod contract. Each request reuses that file; Zod still validates
the final output at runtime. The extension build copies the schema beside its
JavaScript bundle so it is included in the VSIX. Other bundlers must likewise keep
`function-explanation.schema.json` beside the bundled provider module.
Temporary output files live outside the workspace and are removed on every outcome.
Build the package before using the provider. These options were verified with Codex CLI 0.144.4; see the
[official non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode).

`ResultFlow.timeout()` defaults to **120,000 ms**; `timeoutMs` accepts a positive
32-bit integer override, falling back to the default for invalid values.
Cancellation uses `.run({ abortSignal })`. Cancellation and timeout signal the
process tree to stop. On timeout, the flow returns immediately while process
termination and temporary-file cleanup continue in the background, in that order.
On POSIX systems termination escalates from SIGTERM to SIGKILL after one second;
Windows uses `taskkill /t /f`. Caller cancellation waits for cleanup unless the
deadline expires first, in which case the result is `timeout`.

`CodexCliError` uses a `reason` discriminator:

- `workspace-not-directory`: the workspace path is not a directory.
- `codex-not-available`: executable lookup failed.
- `execution-failed`: process failure or nonzero exit, with `cause`.
- `invalid-output`: missing, malformed, or schema-invalid output, with `cause`.
- `cancelled`: caller cancellation.
- `timeout`: execution exceeded the configured limit.
- `codex-not-authenticated`: reserved for reliably identified authentication failures.

The verified CLI interface does not expose a reliable structured authentication
error code. Authentication failures therefore return `execution-failed`; human
messages are not used for classification. Captured stderr is bounded and common
credential formats are redacted; diagnostics are never automatically logged.
Unexpected exceptions and cleanup failures before timeout reject execution,
preserving their causes rather than turning them into expected results. After a
timeout has returned, later cleanup exceptions cannot reach the caller. Background
cleanup also requires the host process to remain alive. No additional `QueryError`
wrapper is introduced: typed failures use the existing neverthrow/ResultFlow contract.
