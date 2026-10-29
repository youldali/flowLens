# Migration cleanup

Cleanup status and remaining opportunities identified during review of the [TypeScript migration](typescript-7-migration.md). Remaining tasks are conditional on their stated prerequisites.

## Completed: remove the temporary repository context

Implementation discovery now uses the native compiler. Source navigation is handled by VS Code. Both `LegacyProjectServiceRegistry` and the temporary `RepositoryAnalysisContext` wrapper have been removed.

`TypeScriptCompilationRegistry.create(root)` creates a registry and native server for one analysis. The registry owns its repository root, compilation cache, snapshots, and cleanup. `GraphAdapter.create(configPath, compilationRegistry)` borrows it directly. The registry is exported at `@flowlens/analyzer-core/infrastructure/typescript-compilation-registry`; the old context export has been removed.

- The shared analyzer-core `WorkspaceAnalysisService`, used by the extension and CLI, creates a fresh registry per analysis, loads workspace compilations, runs an instance of `GraphAdapter`, and awaits cleanup before returning.
- Concurrent requests, including those for the same workspace, use independent registries and native servers. Registry operations are sequenced by their owner, without internal queues.
- Service shutdown rejects new requests and waits for accepted analyses through cleanup. Analysis and cleanup failures are reported to the analysis caller, with both failures preserved when necessary.
- Service, registry, server, and extension tests cover fresh resources, repository isolation, terminal cleanup, shutdown ordering, and retained graph revisions.

Call registry `clear()` only after its analysis finishes. Cleanup is terminal and idempotent; further resource access rejects. Start another analysis with a new registry. Returned `FlowGraph` records remain usable after cleanup; borrowed compiler handles do not.

## Remove the manual LSP layer if TypeScript exposes implementation discovery

In the installed `typescript@7.1.0-beta`, the standalone compiler API does not expose the implementation query FlowLens needs. The native language server exposes it through `textDocument/implementation`. This gap motivated our LSP integration; it is not evidence that TypeScript intends to require LSP permanently.

`NativeLanguageServer` starts an LSP process and connects the compiler API to that same process so compiler snapshots and implementation queries can share project and document state. Production implementation discovery now uses this native LSP query through the shared `TypeScriptCompilationRegistry` server.

If a future public standalone compiler API provides implementation discovery with the required cross-project behavior, evaluate removing the entire `native-language-server.ts` wrapper. Candidates include:

- Manual platform-binary resolution through `createRequire`, executable path construction, and `spawn()`.
- JSON-RPC transport, LSP initialization, request handlers, request timeouts, stderr collection, and manual process shutdown.
- `textDocument/implementation` requests and their LSP-specific result types.
- `updateFile()`'s LSP `didOpen`/`didChange` notifications and document-version tracking.
- `custom/initializeAPISession`, `API.fromLSPConnection()`, and LSP-backed snapshot acquisition.
- The direct `vscode-jsonrpc` dependency, if no other code uses it.
- The extension bundle's `import.meta.url` replacement and supporting banner, if no remaining bundled code needs them.

This requires adapting `TypeScriptCompilationRegistry` to the standalone compiler API, not simply deleting the wrapper. Replace configuration loading, project/snapshot acquisition, file updates, and disposal with supported standalone equivalents. The native compiler process still exists, but its lifecycle can be managed by the compiler API instead of our manual LSP client.

Before removing the layer, verify implementation-query parity across sibling packages, project references, and aliases; shared visibility of unsaved edits; snapshot isolation; cleanup; and extension packaging. Keep repository-scoped ownership, asynchronous resource management, and snapshot lifetime handling regardless of whether LSP is used.

The legacy registry and temporary context have already been removed. Removing the LSP layer remains a separate, conditional opportunity; the current implementation uses LSP.
