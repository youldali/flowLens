---
name: coding-guidelines
description: FlowLens coding style preferences to use when editing source code, especially error handling, declarative style, concise control flow, and return expressions.
metadata:
  short-description: FlowLens code style preferences
---

# Coding Guidelines

Use these project style preferences when editing FlowLens code.

## Package Path Aliases

- Inside a package, use path aliases when referring to top-level folders directly under `src/`, such as `domain`, `infrastructure`, and `common`.
- Use `@domain/...`, `@infrastructure/...`, and `@common/...` instead of relative paths such as `../domain/...` or `../../common/...`, including in re-exports.
- Keep aliases local to the package and ensure its TypeScript and build/runtime tooling resolve them correctly.

## Shared Generic Functions

- Before writing a generic helper or inline callback, check `packages/common/src` for an existing reusable function, especially `packages/common/src/utils.ts`.
- Reuse those functions through the package exports. For example, import `identity` from `@flowlens/common/utils` instead of writing `value => value`.

## Error Handling

Follow a Rust-inspired distinction between failures that prevent correct operation and expected outcomes.

- Never fail silently. Do not catch an error and merely log it, skip the failed operation, or return a success-shaped fallback that hides the failure.
- If a failure prevents the program from functioning correctly, throw an exception. When catching an underlying error, throw a new `Error` with meaningful operation context and preserve the original error in `cause`.
- For expected failures or outcomes that are not really errors, return a `Result` from `neverthrow`, using `ok` for success and a typed `err` for the expected alternative. For example, finding no implementations of a type in a package should return `err('not-found')` rather than throw.
- Callers must handle or propagate these results explicitly. Do not turn unexpected exceptions into an expected result such as `not-found`.

```ts
try {
  return loadProjectConfig(configPath);
} catch (error) {
  throw new Error(`Failed to load project config ${configPath}`, { cause: error });
}
```

```ts
function findImplementations(): Result<ImplementationEntry[], 'not-found'> {
  const entries = discoverImplementations();
  return entries.length > 0 ? ok(entries) : err('not-found');
}
```

## ResultFlow

### When to Use It

- Prefer `ResultFlow<T, E>` over `Promise<Result<T, E>>` in controllers and orchestration methods. Execute the flow at the application or framework boundary when a promise or response is required.
- Use ResultFlow when several `Promise<Result<...>>`, `Result`, or `ResultFlow` operations need to be unwrapped and composed, with typed failures stopping the success path.
- Use it for complex workflows involving branching, retries, recovery, or coordinated error handling and cleanup.
- Keep simple infrastructure helpers as ordinary async functions returning `Promise<Result<T, E>>` when a regular `try/catch` is clearer. Do not introduce ResultFlow solely to wrap one operation or replace every `try/catch`. Lift the helper into a flow at the orchestration layer when needed.

### Construction and Composition

- Use `ResultFlow.gen` when the body unwraps results with `yield*`. Unwrap a `Promise<Result<...>>` with `yield* await operation()` and a `ResultFlow` with `yield* flow`.
- Use `ResultFlow.from(() => operation())` to lift an existing result-producing operation. If no results need unwrapping, prefer `from` over a generator; return `ok(value)` when the callback produces a plain success value.
- Compose flows with `chain` or `yield*` rather than nesting generators and manually calling `.run()` to inspect intermediate results. A `chain` callback can also provide a resource scope shared by subsequent work and its cleanup handler.
- Prefer the simplest appropriate mechanism. For example, native Promise `.finally()` is sufficient when the task is just to remove an already tracked promise after it settles.

### Failures and Cleanup

- Keep typed failures and exceptions distinct, following the Error Handling rules above. In ResultFlow 2.2, `ifFailure` receives either `{ kind: 'err', error }` or `{ kind: 'exception', cause }`.
- Use `.ifFailure(...)` for effects or cleanup needed only on failure. It observes both typed failures and exceptions; it does not recover the flow.
- Use `.finally(exit => ...)` for cleanup on every outcome, including success. Inspect `exit.kind` (`'ok'`, `'err'`, or `'exception'`) when cleanup must account for the original outcome.
- Use `.catch(...)` to handle exceptions, including translating recognized boundary failures into typed errors. Scope it to the relevant operation: credential-loading failures must not catch and relabel later generation failures. Typed errors pass through `.catch(...)` unchanged.
- Preserve the original failure if cleanup also fails, using an `AggregateError` when appropriate. Attempt all required resource disposals even if one fails.

### Preconditions

- Use `.precondition(predicate, onFailure)` for execution-sensitive guards, such as shutdown checks, instead of placing the guard in the flow body. It checks before the wrapped flow starts on every execution; constructing the flow does not run either callback.
- Return the typed error payload from `onFailure`; ResultFlow wraps it in a neverthrow `Err`. Do not return `err(...)` from this callback, which would nest the error. Include the payload type in the flow's error union.
- Treat expected guard failures, such as a workspace closing, as typed errors rather than throwing. Exceptions thrown by either callback still reject execution.
- Use `.ensure(...)` when validation depends on a successful upstream value; use `.precondition(...)` when work must be prevented from starting.

```ts
return ResultFlow.from(() => this.performAnalysis(filePath, offset))
  .precondition(
    () => !this.closing,
    () => ({ reason: 'workspace-closing' } as const),
  );
```

### Lazy Execution and Resource Ownership

- Pass a thunk to `from` when execution must remain lazy: `ResultFlow.from(() => load())`, rather than `ResultFlow.from(load())`, which starts the operation immediately.
- Keep work guarded by a precondition lazy: a precondition cannot defer an already-started promise.
- Acquire resources and allocate mutable execution state per run. Keep repeated and concurrent runs independent, and attach cleanup within the scope that owns the resources.
- Clean up resources acquired before a failure. After successful ownership transfer, leave disposal to the receiving owner; resources used only for the duration of a flow should be disposed on every exit.

## Variable Naming

- Prefer explicit, unambiguous variable names that describe the value's domain and purpose.
- Avoid generic names such as `context`, `data`, or `service` when a more specific name makes their role clearer. For example, prefer `repositoryAnalysisContext` over `context` for a `RepositoryAnalysisContext` instance.

## Function Naming

- Generally start function names with a verb that describes their action, such as `fetch`, `get`, `generate`, `verify`, or `check`.
- For example, prefer `getExplanationQueryKey` over `explanationQueryKey`.

## Function Ordering

- Place exported functions at the top of the file, after imports and module-level constants, with private helper functions below them.

## Declarative Style

- Prefer declarative code over imperative control flow and mutable intermediate state.
- Express collection transformations with operations such as `map` and `filter` or `reduce`, and compose focused methods that describe intent.
- Preserve lazy evaluation where it matters, and keep side effects explicit in focused methods. Use imperative code when it makes those effects or complex logic clearer.

## Return Style

- Prefer a ternary expression for simple two-branch returns.
- Apply this when an `if (condition) return A;` branch is immediately followed by `return B;`.
- Keep an explicit `if` when either branch has multiple statements, side effects, comments, or would become hard to read as a ternary.

Preferred:

```ts
return value ? ok(value) : err({ reason: "not-found" });
```

Avoid:

```ts
if (value) {
  return ok(value);
}

return err({ reason: "not-found" });
```

## Loop Spacing

- Add a blank line before and after each loop (`for`, `for...of`, `for...in`, `while`, and `do...while`) to separate it from surrounding statements.
- No blank line is needed between a loop and an enclosing block's opening or closing brace.
- Follow the spacing in `findImplementationsInProjectService` in `packages/analyzer-core/src/project-service.ts`:

```ts
const implementationEntries: ImplementationEntry[] = [];

for (const location of locations) {
  // Build and collect implementation entries.
}

return implementationEntries;
```

## Semantic Grouping and Declaration Spacing

- Within function bodies and nested blocks, group statements by purpose and separate different concerns with a blank line.
- Keep related single-line declarations and their immediate validation or error checks together. Do not automatically insert a blank line between declarations and the statements that use them.
- Separate an unrelated guard, such as a shutdown check, from the lookup and validation that follow it.
- Keep resource lookup, creation, and registration together, then add a blank line before starting the work that uses that resource. A state update belongs with the setup it completes.
- Likewise, keep capturing resources and clearing their registry together, then separate disposal with a blank line. Keep disposal results, failure collection, and the immediate error check together.
- Keep the loop spacing convention above.

```ts
if (this.closing) throw new Error('Repository analysis service is shutting down');

const resolvedFilePath = path.resolve(filePath);
const tsconfigPathResult = findNearestTsconfig(path.dirname(resolvedFilePath));
if (tsconfigPathResult.isErr()) return err({ reason: 'tsconfig-not-found' });

const repositoryRoot = findWorkspaceRoot(tsconfigPathResult.value);
const compilationRegistry = this.compilationRegistries.get(repositoryRoot) ?? new TypeScriptCompilationRegistry(repositoryRoot);
this.compilationRegistries.set(repositoryRoot, compilationRegistry);

const analysisPromise = Promise.resolve().then(() =>
  GraphAdapter.analyze(tsconfigPathResult.value, compilationRegistry, resolvedFilePath, offset));
```

## Map and Set Type Aliases

- Generally prefer descriptive type aliases for Map keys and Set values when the underlying type does not explain what they represent (for example, `ConfigPath` instead of `string`).
- Declare shared aliases in the module that owns the concept and import them where needed.

```ts
type ConfigPath = string;

const projectServices = new Map<ConfigPath, ProjectService>();
const discoveredConfigs = new Set<ConfigPath>();
```
