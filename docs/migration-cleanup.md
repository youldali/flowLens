# Migration cleanup

Cleanup opportunities identified during review of the [TypeScript migration](typescript-7-migration.md). These are conditional follow-up tasks, not changes to apply before their prerequisites are met.

## Remove the temporary repository context after the migration

`RepositoryAnalysisContext` currently stores the repository root, owns the native and legacy project-service registries, and clears both together. It gives callers one owner while graph construction uses the native compiler and implementation discovery still uses TypeScript 6.

Once implementation discovery and source navigation have migrated, remove `LegacyProjectServiceRegistry`. If the context has no additional responsibilities at that point, remove `RepositoryAnalysisContext` as well: the native `ProjectServiceRegistry` already owns its root, server, project cache, snapshots, and cleanup.

- Pass the repository-scoped registry directly into graph analysis.
- Let the CLI own one registry and the extension reuse registries by repository root.
- Update package exports, callers, tests, and cleanup callbacks to remove the wrapper.
- Preserve repository isolation and wait for active analyses before disposing their resources.

Do not retain the context solely for hypothetical future responsibilities.

## Remove the manual LSP layer if TypeScript exposes implementation discovery

In the installed `typescript@7.1.0-beta`, the standalone compiler API does not expose the implementation query FlowLens needs. The native language server exposes it through `textDocument/implementation`. This gap motivated our LSP integration; it is not evidence that TypeScript intends to require LSP permanently.

`NativeLanguageServer` starts an LSP process and connects the compiler API to that same process so compiler snapshots and implementation queries can share project and document state. Production implementation discovery still uses the legacy registry; the native LSP implementation query is implemented and tested but not yet wired into discovery.

If a future public standalone compiler API provides implementation discovery with the required cross-project behavior, evaluate removing the entire `native-language-server.ts` wrapper. Candidates include:

- Manual platform-binary resolution through `createRequire`, executable path construction, and `spawn()`.
- JSON-RPC transport, LSP initialization, request handlers, request timeouts, stderr collection, and manual process shutdown.
- `textDocument/implementation` requests and their LSP-specific result types.
- `updateFile()`'s LSP `didOpen`/`didChange` notifications and document-version tracking.
- `custom/initializeAPISession`, `API.fromLSPConnection()`, and LSP-backed snapshot acquisition.
- The direct `vscode-jsonrpc` dependency, if no other code uses it.
- The extension bundle's `import.meta.url` replacement and supporting banner, if no remaining bundled code needs them.

This requires adapting the project registry to the standalone compiler API, not simply deleting the wrapper. Replace configuration loading, project/snapshot acquisition, file updates, and disposal with supported standalone equivalents. The native compiler process still exists, but its lifecycle can be managed by the compiler API instead of our manual LSP client.

Before removing the layer, verify implementation-query parity across sibling packages, project references, and aliases; shared visibility of unsaved edits; snapshot isolation; cleanup; and extension packaging. Keep repository-scoped ownership, asynchronous resource management, and snapshot lifetime handling regardless of whether LSP is used.

This opportunity is independent of removing the legacy registry and temporary context: the migration can finish using LSP even if TypeScript never adds the standalone method.
