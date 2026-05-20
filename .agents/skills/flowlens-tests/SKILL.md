---
name: flowlens-tests
description: FlowLens project test and fixture conventions. Use when Codex writes or updates unit tests, Node test runner files, or fixtures in the FlowLens repository, especially files under src/**/*.test.ts or src/fixtures.
---

# FlowLens Tests

Follow these conventions when adding or updating tests and fixtures in the FlowLens repository.

## Unit Tests

- Use Node's built-in test runner.
- Put tests next to the source file unless the repo establishes a more specific local pattern.
- Each unit test file must have one top-level `describe` block named after the function under test.
- Nest all tests for that function inside the function-level `describe` block.
- Keep the test count proportional to the function. If one test covers the behavior, write one test.

Example:

```ts
describe("create", () => {
  it("creates the expected value", () => {
    // assertions
  });
});
```

## Fixtures

- Add fixtures in `src/fixtures`.
- Create domain elements such as nodes or edges through fixtures when tests need them.
- Fixture files must use `createFixture` from `src/fixtures/create-fixture.ts`.
- Fixture files should expose a `create` function for their matching domain type.
- Split fixtures by domain:
  - Use `src/fixtures/node.ts` for FlowLens node interfaces such as `Node`, `FileNode`, and `CallExpressionNode`.
  - Use `src/fixtures/edge.ts` for `Edge`.
  - Use `src/fixtures/ts-node.ts` for TypeScript compiler AST types such as `ts.Node` and `ts.CallExpression`.

Example:

```ts
import type { Edge } from '../edge.js';
import { createFixture } from './create-fixture.js';

const edgeFixture: Edge = {
  id: "source-node->target-node:calls",
  source: "source-node",
  target: "target-node",
  type: "calls",
};

export const create = createFixture<Edge>(edgeFixture);
```
