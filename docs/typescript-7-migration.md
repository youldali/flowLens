# TypeScript 7.1 migration assessment

Status: **native project management, graph construction, implementation discovery, and source navigation implemented; caller lifecycle and saved-file invalidation implemented; full release validation remains incomplete**.

Step 4 checked on 2026-10-25 with Node 26.1.0 on Linux x86_64. The analyzer package
now includes a pinned `typescript-native` alias for TypeScript 7.1.0-beta and
`vscode-jsonrpc` 8.2.1, with the pnpm lockfile updated. All analyzer runtime compiler operations now use the native API or native LSP. TypeScript 6.0.3 remains a root development dependency for repository build tooling (`tsc` and `ts-node`); analyzer and extension runtime dependencies no longer include it. No separate experiment package or branch was created.

`src/infrastructure/native-language-server.ts` owns a native LSP process and
connects the asynchronous compiler API to that same process through
`custom/initializeAPISession`. Its real-server test verifies saved sibling-project
implementation locations, compiler source text from the
same server, and idempotent disposal. Unsaved-buffer support is intentionally
excluded by the requested saved-files-only policy.

The missing compiler-client implementation method is **not a migration
blocker**: the LSP route now has runtime evidence. Graph construction and its callers now use the native integration. Remaining
work includes full platform packaging validation and performance/memory measurements.

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
| `readConfigFile`, `parseJsonConfigFileContent` in project configuration | `API.readConfigFile`, `API.parseJsonConfigFileContent`, `API.parseConfigFile` | Configuration argument shapes differ. Custom configurations, aliases, and unbuilt references are covered by native tests. |
| `createLanguageService(host)`, `languageService.getProgram()` in the project registry | `API.createSnapshot`, snapshot projects/programs; `API.createProgram` for explicit roots | Replace the legacy host and lifecycle, rather than renaming imports. |
| `program.getTypeChecker()` in the graph adapter | `program.getProject().checker` | The checker belongs to its snapshot/project. |
| `createSourceFile` in fixtures/tests | `API.createSourceFile` | Returns a retained source-file lease that must be disposed. Parsing is a compiler request. |
| `ts.forEachChild`, `node.parent` | `node.forEachChild`, `node.parent` from `typescript/ast` | Traversal and parent navigation are local after fetching the AST. |
| Node guards and callable node types | `typescript/ast/is` and `typescript/ast` | Some names change: `isMethodSignatureDeclaration` / `MethodSignatureDeclaration`, and `PropertySignatureDeclaration`. Audit all guards and types. |
| Text, positions, source files, line/column conversion | Native node `getText`, `getStart`, `getEnd`, `getSourceFile`; source-file `getLineAndCharacterOfPosition` / `getPositionOfLineAndCharacter` | Preserve distinctions between `pos` and `getStart`; LSP UTF-16 ranges are converted locally. Emoji and CRLF implementation spans are tested. |
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

`ImplementationDiscovery` caches completed results by absolute file path and offset
within one graph adapter. Failed queries are not cached. Managed analysis creates
fresh adapters and native state per request, and disposes them before returning
plain graph records. Caches never cross managed analysis revisions.

### Native project registry (migration step 1)

`TypeScriptCompilationRegistry` uses the native API exclusively. It owns one LSP
server per analysis, parses configurations with the native compiler, and
loads configured projects with `openProjects` and `ensurePrograms`. It exposes
native projects directly to adapters, which access their programs and checkers.
Custom configuration names, `extends`, path aliases, and unbuilt project
references are covered by real-compiler tests. Workspace discovery follows
references, excludes output directories, and skips empty shared configurations.

`create`, `getProject`, `getProjects`, and `clear` return promises.
The factory returns a `Result` containing a fully initialized registry or a typed
configuration failure; failed initialization releases acquired resources. The owning
analysis sequences registry operations; the registry has no operation queues.
Failed loads are not cached. During `create()`, the registry discovers
workspace configurations and follows their project references, then
acquires one shared snapshot. All returned projects belong to that snapshot.
A later request for a configuration absent from the snapshot returns
`config-not-in-snapshot`; callers need a fresh registry to include it.
Cleanup releases the shared snapshot once and the native server, reports failures,
and rejects later resource access. `WorkspaceAnalysisService` owns this lifetime.

The temporary legacy registry, configuration/discovery helpers, and their
obsolete mocks have been removed in step 3. Their configuration, reference,
isolation, discovery, and disposal behavior is covered by native registry tests.
There is no fallback to the legacy compiler.

Validation: the full analyzer suite passed (146 tests at that run). Two further
discovery/disposal cases were then added; all six native-registry tests passed
in the targeted rerun. Native tests require local Unix sockets on Linux and
therefore need to run outside a sandbox that prohibits socket creation.

### Repository-scoped analysis ownership

`await TypeScriptCompilationRegistry.create(root)` returns a
result containing a fresh registry and native server for one analysis. It discovers only its resolved repository root,
and direct configuration requests outside that root are rejected. The shared
snapshot is acquired during creation and remains available until terminal cleanup.

`GraphAdapter.create(filePath, compilationRegistry)` borrows the registry directly.
It selects the file's default project through `registry.getProjectForFile(filePath)`,
which delegates to the existing snapshot's `getDefaultProjectForFile`. Only
configured projects registered in that snapshot are accepted. The compiler decides
between overlapping configurations; FlowLens does not rank app/test/build configs.
No usable configurations produce `tsconfig-not-found`; an unowned file produces
`project-not-found`. Unreferenced nonstandard configuration filenames are not loaded.
Implementation discovery uses the same server and shared snapshot.
`getProjects()` returns the projects already loaded during creation.
The analyzer exports the registry at
`@flowlens/analyzer-core/infrastructure/typescript-compilation-registry`.
The temporary `RepositoryAnalysisContext` wrapper and its export have been removed.

The CLI and extension use `WorkspaceAnalysisService`, which creates a registry for
every analysis and clears it before returning. Its `dispose()` rejects new work
and waits for accepted analyses, including initialization and cleanup. Closing one
viewer leaves other viewers' resources independent. Registry `clear()` is terminal
and idempotent; another analysis requires a new registry.

### Native graph construction (migration step 2)

`GraphAdapter.create(filePath, compilationRegistry)`, `fromFile`, and `fromFilePosition` are
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
validation remains a later step.

### Native implementation discovery (migration step 3)

`ImplementationDiscovery.findImplementations` now awaits workspace discovery,
loads all configured projects into the shared server, and issues one native
`textDocument/implementation` request for the declaration. The native LSP handles
multi-project discovery; FlowLens does not scan names or infer candidates from
assignability. This works without opening documents artificially or building
referenced outputs, including explicitly selected custom configurations.

Results are resolved against registered native programs. File URIs are decoded
with `fileURLToPath`; LSP UTF-16 line/character ranges become source offsets via
`getPositionOfLineAndCharacter`. Entries retain their source name, normalized
path, one-based line/column, and zero-based offset. Declaration files,
`node_modules`, missing files, and sources outside the workspace remain
non-navigable. Entries are deduplicated by file/offset and sorted deterministically.
Source navigation is handled by VS Code using implementation locations. The CLI
viewer does not expose a source endpoint, and analysis does not retain full files
for source navigation.

Graph calls still reference interface/type-member declarations. Potential
implementations are metadata on those declarations; discovery does not traverse
implementation bodies or replace interface edges with speculative runtime targets.
A graph with discovery enabled has the same nodes and edges as one with only
implementation metadata suppressed.

Real-compiler tests cover sibling projects, path aliases, re-exports, imported
aliases, multiple classes and an object literal, a separate custom-config
project, and exclusion of unrelated same-named methods. The selected program
cannot see the sibling implementation source, but implementation discovery can.
The tests assert exact offsets, names, lines, and columns, including a path with
spaces, CRLF, and an emoji before a method. The mapped-type fixture still returns
no candidates, matching the legacy language service's known limitation; no name
matching fallback is added. Tests also cover deduplication, navigation filtering,
repeated cached queries, failure propagation, and retry after a failed request.

The published compiler-client language service still has no implementation
query. Its reference queries are not a substitute. The native LSP exposes the
required query; `API.fromLSPConnection` and `getCurrentLanguageServerSnapshot`
connect compiler queries to that same server. No native implementation-discovery
capability blocker was found in the scenarios tested here.

### Callers and lifecycle (migration step 4)

`WorkspaceAnalysisService.analyze(file, offset?)` is the application boundary.
It finds the workspace root from the source file, creates a fresh registry with
all discovered projects in one snapshot, calls `GraphAdapter.create(file, registry)`,
then calls the adapter's instance method `analyze(file, offset?)`.
Root discovery prefers the nearest Git/workspace marker. Without a marker it
uses the nearest directory containing a conventional tsconfig filename, or the
source directory if no configuration is found. Cleanup runs in the service before its
promise settles, including when adapter creation, discovery, or analysis fails.
The adapter builds the graph. Its returned `FlowGraph` contains detached
graph records, so the graph remains usable after compiler cleanup or later disk
changes. It does not expose source lookup or retain full-file navigation text.
Low-level `create`/`fromFile` APIs remain available for callers explicitly borrowing
compiler resources.

The invalidation policy is deliberately coarse: every analysis starts with a new
native server and a fresh shared snapshot, and all native resources are released in its
`finally` block. Disk edits, dependency edits, tsconfig changes, file additions,
deletions, and project discovery therefore cannot reuse the previous analysis's
compiler or implementation caches. This sacrifices warm compiler reuse and pays
startup/discovery costs on each request. It is a correctness baseline, not an
incremental-performance claim. The published shared-LSP snapshot change type has
no `fileNotifications`/`fileSystem` fields; those belong to independent snapshots.
This implementation does not mix independent snapshot updates with live LSP state.

Every request has independent resources, so analyses in the same workspace can
run concurrently. Each owner sequences its registry operations; there are no
registry queues or cross-analysis caches. Analysis reads saved files. There are
no editor-text overrides, open buffer maps, or LSP document-update notifications
in the integration. VS Code opens source files using the locations in graph metadata.

Registry `clear()` is terminal and idempotent and must follow completed resource
access. Service `dispose()` rejects new analyses and waits for all accepted ones
through cleanup. Snapshots and native servers are released on success and failure.
If both analysis and cleanup fail, both errors are preserved in an `AggregateError`
returned to the analysis caller; shutdown does not replay those failures. Native
server disposal also shares one promise across concurrent calls. Returned
graph results remain usable after cleanup; borrowed compiler handles do not.

The extension requires repository documents to be saved before Generate Graph.
It checks the active document and dirty file documents under the same repository
root, including configuration files, before reading the cursor offset or starting
analysis. Dirty files in another repository do not block it. It prompts the user
to save and does not save files automatically. Changes during an in-flight command
invalidate its display result; newer commands supersede older ones. Deactivation
prevents late panel updates and waits for all accepted work. Untitled documents
still need a file URI. The UI does not regenerate graphs on each keystroke.

The CLI reanalyzes current disk state on `/graph.json`. Each response gets a
fresh graph ID. The CLI frontend does not provide `onOpenSource`, so source
navigation is unavailable there. The server no longer exposes `/source` or keeps
previous analysis sessions. Server close waits for requests and disposes its
analysis service; SIGINT/SIGTERM and startup failures also close resources.

Real-compiler tests cover repeated saved edits, file addition/deletion, dependent
semantic changes, tsconfig changes, and graph access after cleanup. Gated tests
verify shutdown waiting through initialization and cleanup, rejected work after disposal, cleanup after failed
analysis, and preservation of combined errors. Consumer tests verify save-required
guards, saved dependency refresh, repository isolation, stale-result suppression,
graph refresh, removal of the source endpoint, and analysis-service shutdown.

## Checks performed and limits

- Analyzer: 146 tests passed from current source outputs, including lifecycle, native discovery, registry ownership, and graph adapters. Obsolete generated tests left by prior source renames were removed before the run.
- Server: all 5 tests passed, including graph refresh, revision-bound navigation, and cleanup isolation.
- Extension: all 35 tests passed; type-check and CommonJS bundling passed.
- Frontend: all 125 tests passed; production build passed. Packaging results from step 3 remain below.
- A real graph build from a CommonJS bundle loaded the native compiler and
  resolved a documented function successfully.
- Real-compiler assertions cover aliases, re-exports, default imports, imported
  overloads, variable arrows, class methods, function expressions, nested
  functions, unresolved calls, exact declaration spans, containing functions,
  and JSDoc. Existing interface, source-origin, naming, and transformation tests
  continue to pass against the migrated graph adapter.

### Packaging blocker observed in step 3

`pnpm --filter flowlens-vscode package` completed, but inspection of the resulting
VSIX found **no native executable**: the archive contains
`node_modules/typescript-native` but not `@typescript/typescript-linux-x64/lib/tsc`
or another platform binary. It also correctly excludes the legacy
`node_modules/typescript` runtime. The deployment/VSCE dependency-collection
path must include the native compiler's optional platform package before this
extension can ship. A successful packaging exit code is insufficient. The
incomplete generated VSIX was removed.

The workspace installation does contain the platform package; real compiler,
LSP, and consumer tests above ran successfully against it. This packaging
failure is distinct from implementation-discovery capability. Platform-specific
packaging and an installed-VSIX smoke test remain release gates. No cross-platform packaging claim is made.

Native compiler connections and the extension test runner require local IPC
sockets, so their tests ran outside the socket-restricted sandbox. Installed-VSIX
execution, cross-platform binaries, performance/memory measurement, and
large-repository stress behavior have not been validated. The tests establish the
covered lifecycle scenarios, not release-wide platform or performance parity.

## Recommended continuation

Recommendation: **proceed with the LSP-backed migration**. The missing compiler
API method does not require waiting for a future release. Retain the native
discovery and lifecycle changes, but complete release validation before calling
the overall migration conclusive.

1. **Implementation discovery — implemented.** Native LSP is connected to graph
   metadata and source navigation, with cross-project semantic tests.
2. **Native adapters and async callers — implemented.** Native graph construction
   and asynchronous CLI/extension callers are in place. IDs use native kinds;
   the graph domain remains free of compiler handles.
3. **Revision ownership — implemented with full invalidation.** Managed requests
   create independent resources per analysis, read saved files, release native resources,
   and return detached graph results. Incremental reuse is a potential
   optimization, subject to semantic and performance validation.
4. **Packaging and verification — medium/high complexity.** The extension
   bundles CommonJS targeting Node 20 and externalizes `typescript-native/async`.
   The new package uses ESM entrypoints and platform-specific optional binary
   packages. Verify module loading and native binary inclusion for supported
   extension targets. Keep legacy tooling dependencies only where required
   by build tools, with no concealed legacy analyzer runtime.
5. **Release decision — medium complexity.** Run graph parity tests, affected
   consumers, repository builds, and packaging checks. Benchmark identical
   cold/repeated/edit workloads and report native-process memory as well as
   JavaScript memory. Accept the migration only after semantic and lifecycle
   behavior, rather than compilation alone, meets the contract.
