---
name: coding-guidelines
description: FlowLens coding style preferences to use when editing source code, especially error handling, declarative style, concise control flow, and return expressions.
metadata:
  short-description: FlowLens code style preferences
---

# Coding Guidelines

Use these project style preferences when editing FlowLens code.

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

## Variable Declaration Spacing

- Keep consecutive single-line variable declarations together, then add a blank line before the subsequent statements that use them.
- Apply this within function bodies and nested blocks, as in `findImplementationsInProjectService` in `packages/analyzer-core/src/project-service.ts`:

```ts
const filePath = normalizePath(source.fileName);
const { start, length } = location.textSpan;
const coordinates = source.getLineAndCharacterOfPosition(start);

implementationEntries.push({
  name: source.text.slice(start, start + length) || path.basename(filePath),
  filePath,
  line: coordinates.line + 1,
  column: coordinates.character + 1,
  offset: start,
});
```

## Map and Set Type Aliases

- Generally prefer descriptive type aliases for Map keys and Set values when the underlying type does not explain what they represent (for example, `ConfigPath` instead of `string`).
- Declare shared aliases in the module that owns the concept and import them where needed.

```ts
type ConfigPath = string;

const projectServices = new Map<ConfigPath, ProjectService>();
const discoveredConfigs = new Set<ConfigPath>();
```
