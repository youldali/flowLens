# FlowLens

FlowLens visualizes TypeScript code flow from inside VS Code.

FlowLens is currently in alpha. The core graph workflow is usable, but analyzer coverage, graph presentation, and extension behavior are still evolving.

## Features

- Generate a graph from the symbol at the active cursor position in a TypeScript or TSX file.
- Render the graph in a VS Code webview beside the current editor.
- Use the editor context menu or the `FlowLens: Generate Graph` command.

## Requirements

- VS Code `1.104.0` or newer.
- A TypeScript or TSX file on disk.
- A `tsconfig.json` at or above the file being analyzed.

## Usage

1. Open a TypeScript or TSX file in a workspace.
2. Place the cursor on the code you want to inspect.
3. Run `FlowLens: Generate Graph` from the Command Palette, or use the editor context menu.

FlowLens opens a graph view beside the editor and reports how many nodes and edges were generated.

## Limitations

- FlowLens currently supports TypeScript and TSX files only.
- Unsaved virtual documents and files outside a `tsconfig.json` project are not supported.
- Graph quality depends on the analyzer's current TypeScript AST coverage.
- Behavior and graph output may change between alpha releases.

## Publishing

This package is prepared for manual Marketplace publishing under publisher `flowlens` with extension ID `flowlens.flowlens-vscode`.

```sh
pnpm --filter ./apps/vscode-extension package
```

The command builds the extension and writes a `.vsix` file that can be uploaded through the Visual Studio Marketplace publisher portal.

For command-line publishing, authenticate and publish the packaged VSIX:

```sh
pnpm --dir apps/vscode-extension exec vsce login flowlens
pnpm --dir apps/vscode-extension exec vsce publish --packagePath flowlens-vscode-0.1.1.vsix
```

## Explanation transport

The webview host retains one `{ graphId, graph }` session. Each successful graph
replacement gets a fresh ID; `view.ready` resends the current session with the
same ID. Closing the panel retains the session until it is replaced.

`explain.node` requests carry `graphId`, `nodeId`, and `requestId`. The host resolves
function implementations from the retained graph and replies with
`explain.node.result` or `explain.node.error`, echoing all three IDs. Stale requests
are rejected; accepted requests use the captured source snapshot. Replies are
sent only to the originating panel while it remains open.

`FlowLensGraphWebview` accepts an explanation function from extension setup.
Before each request the extension reads `flowlens.ai.backend`: `openai-api`,
`claude-api`, or `codex-cli` (default: `openai-api`). API backends retrieve the
provider key from VS Code SecretStorage and call `createFunctionExplainer`.
The Codex backend calls `explainWithCodex` without reading an API key; it uses the
locally installed and authenticated Codex CLI. Select it through the VS Code
`flowlens.ai.backend` setting.
OpenAI uses `gpt-4.1-mini`; Anthropic uses `claude-sonnet-5-5`.

Use **FlowLens: Configure AI Backend** from the Command Palette or the explanation
recovery button to choose OpenAI API, Claude API, or Codex CLI. API backends prompt
for an API key; Codex CLI saves the backend selection without accessing stored keys.
The picker initially highlights the current backend, defaulting to OpenAI API. Input is masked
and stored securely by VS Code, separately for each provider, across reloads and
restarts. Saving updates `flowlens.ai.backend`; cancelling either prompt
leaves settings and keys unchanged. Use **FlowLens: Remove AI API Key** to delete
the current API backend's provider key after confirmation. With Codex selected,
this command leaves stored API keys untouched. Never put API keys in settings.

Backend and key changes apply to subsequent requests without reloading; requests
already started retain their captured credentials. Missing keys produce
`missing-api-token`. Credentials never enter the React webview or IPC messages.
API generator error reasons pass through unchanged. Codex invalid output is reported
as `invalid-output`; other Codex failures use `generation-failed`. Raw provider
details are not logged.

To manually verify persistence, save a key, reload the extension or restart VS Code,
and invoke Remove AI API Key: the confirmation should still appear. Cancel to retain it.

The frontend `useExplainNodeQuery(graphId)` hook provides the transport for later UI
integration. Graph changes and unmounting reject pending requests, and unmatched
or late responses are ignored. Synchronous message-delivery failures reject with
`delivery-failed`. Provider setup uses native VS Code prompts; no request timeout is included.
