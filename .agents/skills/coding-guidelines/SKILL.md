---
name: coding-guidelines
description: FlowLens coding style preferences to use when editing source code, especially concise control flow and return expression style.
metadata:
  short-description: FlowLens code style preferences
---

# Coding Guidelines

Use these project style preferences when editing FlowLens code.

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
