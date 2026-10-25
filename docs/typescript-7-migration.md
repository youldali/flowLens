# TypeScript 7.1 migration assessment

Status: **native project management, graph construction, implementation discovery, and source navigation implemented; edit lifecycle and full release validation remain incomplete**.

Step 3 checked on 2026-10-24 with Node 26.2.0 on Linux x86_64 (the repository declares Node 26.1.x). The analyzer package
now includes a pinned `typescript-native` alias for TypeScript 7.1.0-beta and
`vscode-jsonrpc` 8.2.1, with the pnpm lockfile updated. All analyzer runtime compiler operations now use the native API or native LSP. TypeScript 6.0.3 remains a root development dependency for repository build tooling (`tsc` and `ts-node`); analyzer and extension runtime dependencies no longer include it. No separate experiment package or branch was created.

`src/infrastructure/native-language-server.ts` owns a native LSP process and
connects the asynchronous compiler API to that same process through
`custom/initializeAPISession`. Its real-server test verifies sibling-project
implementation locations, an unsaved edit adding a second implementation,
updated compiler source text, old-snapshot isolation, and disposal.

The missing compiler-client implementation method is **not a migration
blocker**: the LSP route now has runtime evidence. Graph construction and its callers now use the native integration. Remaining
work includes edit invalidation and full platform packaging validation.

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
within one graph adapter. Failed queries are not cached. The registry retains
immutable snapshots until the repository context is cleared. These caches are
not revision-aware yet; edits must not be treated as refreshed analysis until
step 4 provides invalidation. This was also a limitation of the legacy registry.

### Native project registry (migration step 1)

`ProjectServiceRegistry` now uses the native API exclusively. It owns one LSP
server per workspace, parses configurations with the native compiler, and
loads configured projects with `openProjects` and `ensurePrograms`. It exposes
native project, program, and snapshot objects to the adapters.
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

The temporary legacy registry, configuration/discovery helpers, and their
obsolete mocks have been removed in step 3. Their configuration, reference,
isolation, discovery, and disposal behavior is covered by native registry tests.
There is no fallback to the legacy compiler.

Validation: the full analyzer suite passed (146 tests at that run). Two further
discovery/disposal cases were then added; all six native-registry tests passed
in the targeted rerun. Native tests require local Unix sockets on Linux and
therefore need to run outside a sandbox that prohibits socket creation.

### Repository-scoped analysis ownership

`TypeScriptCompilationRegistry(root)` directly owns compiler resources for a
resolved repository root. It is not a singleton. It discovers only its bound root,
and direct configuration requests outside that root are rejected. The registry
lazily starts one server, retains compilation snapshots, and serializes operations
within that repository; different registries have independent queues.

`GraphAdapter.create(configPath, compilationRegistry)` borrows the registry directly.
Implementation discovery uses the same server and registered compilation snapshots.
`getCompilations()` discovers configurations within the registry's root.
The analyzer exports the registry at
`@flowlens/analyzer-core/infrastructure/typescript-compilation-registry`.
The temporary `RepositoryAnalysisContext` wrapper and its export have been removed.

The CLI owns one registry and passes its cleanup callback to the viewer server.
The extension reuses registries by inferred repository root, tracks active
analyses, and waits for them before clearing all registries on deactivation.
Closing one viewer only clears its repository's resources. Registry `clear()`
disposes snapshots and the server, propagates cleanup failures, and is reusable:
subsequent analysis can recreate resources, but callers must stop using earlier
adapters. Automatic edit refresh and cache eviction are not part of this change.

### Native graph construction (migration step 2)

`GraphAdapter.create(configPath, context)`, `fromFile`, and `fromFilePosition` are
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
The same native programs now provide asynchronous source navigation, including
the CLI viewer's `/source` endpoint.

Graph calls still reference interface/type-member declarations. Potential
implementations are metadata on those declarations; discovery does not traverse
implementation bodies or replace interface edges with speculative runtime targets.
A graph with discovery enabled has the same nodes and edges as one with only
implementation metadata suppressed.

Real-compiler tests cover sibling projects, path aliases, re-exports, imported
aliases, multiple classes and an object literal, a separate custom-config
project, and exclusion of unrelated same-named methods. The selected program
cannot see the sibling implementation source, but discovery and navigation can.
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

## Checks performed and limits

- Analyzer: 140 tests passed, including native discovery, repository ownership, native registries, and graph adapters. The count excludes removed legacy-registry/configuration-only tests.
- Server: all 4 tests passed, including cleanup isolation between viewers.
- Extension: all 32 tests passed; type-check, frontend build, and CommonJS bundling passed. Packaging results are recorded below.
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
packaging and an installed-VSIX smoke test remain release gates, along with the
edit lifecycle work. No cross-platform packaging claim is made.

Native compiler connections and the extension test runner require local IPC
sockets, so their tests ran outside the socket-restricted sandbox. Installed-VSIX
execution, cross-platform binaries, performance/memory measurement, and
comprehensive editing/concurrency behavior have not been validated. Passing
these tests does not establish revision-safe analysis after edits.

## Recommended continuation

Recommendation: **proceed with the LSP-backed migration**. The missing compiler
API method does not require waiting for a future release. Retain the native
discovery change, but complete lifecycle and release validation before calling
the overall migration conclusive.

1. **Implementation discovery — implemented.** Native LSP is connected to graph
   metadata and source navigation, with cross-project semantic tests. File edits,
   additions, and deletions remain part of revision ownership below.
2. **Native adapters and async callers — implemented.** Native graph construction
   and asynchronous CLI/extension callers are in place. IDs use native kinds;
   the graph domain remains free of compiler handles.
3. **Revision ownership — high complexity.** Give analysis sessions explicit
   snapshot ownership; version caches and propagate disk and in-memory edits.
   Verify additions, deletions, dependent edits, and disposal. Do not reuse
   symbol identities across snapshots.
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
