# TypeScript 7.1 migration assessment

Status: **native project management and graph construction implemented; implementation discovery remains legacy**.

Checked on 2026-10-22 with Node 26.1.0 on Linux x86_64. The analyzer package
now includes a pinned `typescript-native` alias for TypeScript 7.1.0-beta and
`vscode-jsonrpc` 8.2.1, with the pnpm lockfile updated. The graph adapter now uses the native API;
implementation discovery and source navigation still use TypeScript 6.0.3. No separate experiment package or branch was created.

`src/infrastructure/native-language-server.ts` owns a native LSP process and
connects the asynchronous compiler API to that same process through
`custom/initializeAPISession`. Its real-server test verifies sibling-project
implementation locations, an unsaved edit adding a second implementation,
updated compiler source text, old-snapshot isolation, and disposal.

The missing compiler-client implementation method is **not a migration
blocker**: the LSP route now has runtime evidence. Graph construction and its callers now use the native integration. Remaining
work includes switching implementation discovery, edit invalidation, and full
platform packaging validation.

## Verified target and evidence

The npm `beta` tag resolved to `typescript@7.1.0-beta`, with the matching
`@typescript/typescript-linux-x64@7.1.0-beta` executable. Both packages identify
source revision `3e9236361fa97a9e6c685f4833ac457ae2d8c50a`.
Their published tarballs were downloaded and extracted outside the repository
for inspection and a runtime check; they were subsequently installed through the pinned package alias.

Sources:

- [Published compiler package metadata](https://registry.npmjs.org/typescript/7.1.0-beta)
- [Published Linux executable metadata](https://registry.npmjs.org/@typescript/typescript-linux-x64/7.1.0-beta)
- [Matching asynchronous API source](https://github.com/microsoft/TypeScript/blob/3e9236361fa97a9e6c685f4833ac457ae2d8c50a/packages/typescript/src/api/async/api.ts)
- [Matching language-server source](https://github.com/microsoft/TypeScript/blob/3e9236361fa97a9e6c685f4833ac457ae2d8c50a/tsc/internal/lsp/server.go)
- [7.1 beta announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)
- [Compiler API documentation issue](https://github.com/microsoft/TypeScript/issues/63747)

The documentation issue's August comments predate the October beta. They are
not evidence that the published beta lacks all compiler APIs; the published
declarations and matching source are the basis of this assessment.

## Current compiler integration and native equivalents

The current runtime integration is concentrated in the analyzer-core
infrastructure and adapters. Compiler types also appear in fixtures, mocks,
and tests. The graph domain uses plain records; adapters retain compiler nodes.

| Current operation / owner | Verified native surface | Migration implications |
| --- | --- | --- |
| `readConfigFile`, `parseJsonConfigFileContent` in project configuration | `API.readConfigFile`, `API.parseJsonConfigFileContent`, `API.parseConfigFile` | Configuration argument shapes differ. Custom configuration and reference parity still require execution tests. |
| `createLanguageService(host)`, `languageService.getProgram()` in the project registry | `API.createSnapshot`, snapshot projects/programs; `API.createProgram` for explicit roots | Replace the legacy host and lifecycle, rather than renaming imports. |
| `program.getTypeChecker()` in the graph adapter | `program.getProject().checker` | The checker belongs to its snapshot/project. |
| `createSourceFile` in fixtures/tests | `API.createSourceFile` | Returns a retained source-file lease that must be disposed. Parsing is a compiler request. |
| `ts.forEachChild`, `node.parent` | `node.forEachChild`, `node.parent` from `typescript/ast` | Traversal and parent navigation are local after fetching the AST. |
| Node guards and callable node types | `typescript/ast/is` and `typescript/ast` | Some names change: `isMethodSignatureDeclaration` / `MethodSignatureDeclaration`, and `PropertySignatureDeclaration`. Audit all guards and types. |
| Text, positions, source files, line/column conversion | Native node `getText`, `getStart`, `getEnd`, `getSourceFile`; source-file `getLineAndCharacterOfPosition` | Preserve existing distinctions between `pos` and `getStart`; verify UTF-16 spans. |
| `checker.getResolvedSignature(call)` | `Checker.getResolvedSignature` | Returns a signature even for unresolved calls; use `isUnknownSignature`. Its declaration is a handle, resolved with `NodeHandle.resolve()`. |
| `checker.getSymbolAtLocation`, `symbol.getDeclarations()` | `Checker.getSymbolAtLocation`, `symbol.declarations` | Declarations are node handles, not directly usable AST nodes. |
| `symbol.getDocumentationComment(checker)`, `displayPartsToString` | `Symbol.getDocumentationComment(checker)` | Native result is a string. |
| `program.getSourceFiles`, `getSourceFile` | `Program.getSourceFileNames`, `Program.getSourceFile` | Source-file loading is explicit; async clients return promises. |
| `program.isSourceFileDefaultLibrary` | `Program.isSourceFileDefaultLibrary` | Async metadata request with program-local caching. |
| `languageService.getImplementationAtPosition` | **No equivalent in the published sync/async compiler-client language service** | Native LSP has `textDocument/implementation`; see the migration gate below. |
| `ts.sys` filesystem access and `resolveProjectReferencePath` in workspace discovery | Native host/layered filesystem and parsed project references | No drop-in replacement verified for these application helpers. Preserve workspace discovery and navigation filtering explicitly. |
| Cached programs and script snapshots | `Snapshot.update`, filesystem layers, file notifications | New snapshots represent edits; avoid mixing handles from different snapshots. |
| Language-service disposal | API, program, snapshot, and retained-source disposal | Async clients support asynchronous disposal. Explicit ownership is required. |
| IDs containing numeric `SyntaxKind`, `pos`, and `end` | Native syntax kinds and spans | Do not assume numeric kinds are interchangeable with 6.0.3. IDs now use native kind numbers directly, as requested. Cross-version ID stability is intentionally not preserved. |

The legacy `LegacyProjectServiceRegistry` caches services by configuration, reports
script version `'0'`, and retains the initially obtained program.
`ImplementationDiscovery` separately caches locations by file and offset.
Neither cache key contains a source revision. This is a baseline limitation,
not evidence of working incremental invalidation that a migration can inherit.

### Native project registry (migration step 1)

`ProjectServiceRegistry` now uses the native API exclusively. It owns one LSP
server per workspace, parses configurations with the native compiler, and
loads configured projects with `openProjects` and `ensurePrograms`. It exposes
native project, program, and snapshot objects to the upcoming adapter migration.
Custom configuration names, `extends`, path aliases, and unbuilt project
references are covered by real-compiler tests. Workspace discovery follows
references, excludes output directories, and skips empty shared configurations.

`getService`, `getProjectServices`, and `clear` now return promises. Concurrent
registry operations are serialized so duplicate loads share a service and a
pending load cannot repopulate the registry after `clear`. Failed loads are not
cached. Each returned service retains its immutable snapshot until `clear`;
adding another project does not dispose a previously returned service. Callers
must not use services after clearing the registry. `clear` disposes all snapshots
and servers, reports cleanup failures, and permits fresh workspace discovery.
Automatic edit refresh and revision-aware graph caches remain part of step 4.

To keep step 1 independently buildable, the old registry and its tests were
moved to `legacy-project-service-registry`. Implementation discovery explicitly imports `LegacyProjectServiceRegistry`
until step 3; graph construction now consumes the native registry.
There is no automatic fallback from the native registry to the legacy compiler.

Validation: the full analyzer suite passed (146 tests at that run). Two further
discovery/disposal cases were then added; all six native-registry tests passed
in the targeted rerun. Native tests require local Unix sockets on Linux and
therefore need to run outside a sandbox that prohibits socket creation.

### Native graph construction (migration step 2)

`GraphAdapter.create(configPath)`, `fromFile`, and `fromFilePosition` are
asynchronous. The CLI and extension await them. Graph extraction remains
synchronous and produces plain domain records; no native AST, symbol, or
signature handles enter the serialized graph. Native source locations,
function naming, call containment, standard-library classification, and
JSDoc metadata are covered by tests.

`NodeAdapter` resolves native signature/declaration handles in their owning
project, detects unknown signatures, and follows import aliases when selecting
an executable overload body. Call-resolution results are cached per AST node
within the adapter's immutable snapshot. AST helpers and fixtures now use the
native AST types, predicates, and parser.

IDs retain the existing file/kind/span format, but the kind number is the native
compiler's value. No legacy ID mapping is present. The user explicitly waived
cross-version ID preservation.

The extension declares the native compiler runtime dependency. Its CommonJS
bundle embeds AST utilities, dynamically imports the asynchronous native API,
and preserves the bundle's module URL for native executable resolution. A
CommonJS graph-build smoke check passed. Native sessions are cleared on server
close, CLI startup failure, and extension deactivation. Full VSIX/platform
validation and editing lifecycle work remain later steps.

Implementation discovery and source navigation remain on their explicit legacy
path until step 3. This is a staged migration, not a fully native analyzer yet.

## Implementation-discovery migration gate

FlowLens currently asks each workspace project's language service for
implementations, filters navigable sources, deduplicates file/offset pairs,
and sorts results. Its real-compiler tests establish that an implementation
can be absent from the entry project's program and present in a sibling
project with different options and path aliases. They also characterize a
mapped-type case returning no implementations.

Inspection of both published compiler-client declarations, their protocol
method list, and the matching asynchronous API source found no implementation
query. The native `Project.languageService` exposes reference, signature-usage,
completion, formatting, and import-edit operations, but no
`getImplementationAtPosition` equivalent. Reference queries are not an
implementation query. Assignability or explicit `implements` scans alone
have not been established to reproduce the existing language-service behavior.

This is **not a claim that TypeScript 7.1 cannot discover implementations**.
The matching Go language server registers `TextDocumentImplementationInfo`
with `ProvideImplementations` through a multi-project request handler.
The published `typescript/vscode` protocol declarations also describe
`textDocument/implementation`.

Using that route requires a language-server client and a shared state strategy
for compiler queries and implementation queries. The compiler API offers
`API.fromLSPConnection` and `getCurrentLanguageServerSnapshot`, which are
promising integration points. A standalone Node client must establish and own
the server connection; the VS Code SDK connection depends on an initialized
language server. The standalone Node route is now implemented and runtime-validated by the
colocated native-language-server test. VS Code integration remains pending.

The native compiler client alone does not provide this query. Combining LSP
implementation requests and compiler snapshots from the same server avoids a
legacy implementation fallback. Implementation discovery is not yet wired into graph generation; its existing
legacy implementation is retained until step 3.

## Checks performed and limits

- Analyzer: 149 tests passed, including the native registry and graph adapters.
- Server: all 3 tests passed with asynchronous native graph construction.
- Extension: all 26 tests passed; type-check and CommonJS bundling passed.
- A real graph build from a CommonJS bundle loaded the native compiler and
  resolved a documented function successfully.
- Real-compiler assertions cover aliases, re-exports, default imports, imported
  overloads, variable arrows, class methods, function expressions, nested
  functions, unresolved calls, exact declaration spans, containing functions,
  and JSDoc. Existing interface, source-origin, naming, and transformation tests
  continue to pass against the migrated graph adapter.

Native compiler connections and the extension test runner require local IPC
sockets, so their tests ran outside the socket-restricted sandbox. Full VSIX
installation, cross-platform binaries, performance/memory measurement, and
comprehensive editing/concurrency behavior have not been validated. Passing
these tests does not establish that the remaining legacy discovery integration
has migrated.

## Recommended continuation

Recommendation: **proceed with the LSP-backed migration**. The missing compiler
API method does not require waiting for a future release. Graph construction has switched; complete the remaining discovery and lifecycle
work before treating the analyzer as fully migrated.

1. **Implementation discovery — integration started.** Native LSP now passes
   the sibling-project fixture and shared-state test. Extend coverage to
   unrelated same-named methods, mapped types, and file additions/deletions
   before switching production graph construction.
2. **Native adapters and async callers — implemented.** Native graph construction
   and asynchronous CLI/extension callers are in place. IDs use native kinds;
   the graph domain remains free of compiler handles.
3. **Revision ownership — high complexity.** Give analysis sessions explicit
   snapshot ownership; version caches and propagate disk and in-memory edits.
   Verify additions, deletions, dependent edits, and disposal. Do not reuse
   symbol identities across snapshots.
4. **Packaging and verification — medium/high complexity.** The extension
   currently bundles CommonJS targeting Node 20 and externalizes `typescript`.
   The new package uses ESM entrypoints and platform-specific optional binary
   packages. Verify module loading and native binary inclusion for supported
   extension targets. Keep legacy tooling dependencies only where required
   by build tools, with no concealed legacy analyzer runtime.
5. **Release decision — medium complexity.** Run graph parity tests, affected
   consumers, repository builds, and packaging checks. Benchmark identical
   cold/repeated/edit workloads and report native-process memory as well as
   JavaScript memory. Accept the migration only after semantic and lifecycle
   behavior, rather than compilation alone, meets the contract.
