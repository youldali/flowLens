---
name: flowlens-tests
description: FlowLens project test and fixture conventions. Use when Codex writes or updates unit tests, Node test runner files, or fixtures in the FlowLens repository, especially files under src/**/*.test.ts or src/fixtures.
---

# FlowLens Tests

Follow these conventions when adding or updating tests and fixtures in the FlowLens repository.

## Unit Tests

- Use Node's built-in test runner.
- Organize test files by **source file**, not by function. Each source file has one matching test file beside it: `name.ts` → `name.test.ts`, including `index.ts` → `index.test.ts`.
- All unit tests for functions defined in that source file belong in its matching test file. Add to the existing file when it exists; do not create a separate test file for each function.
- Inside the matching test file, give each function under test its own top-level `describe` block, named exactly after the function. A source file with multiple tested functions therefore has multiple sibling top-level `describe` blocks in one test file.
- Nest each function's `it` cases inside its own `describe` block. Do not put one function's tests inside another function's block.
- When moving a function to another source file, move its tests into the destination source file's matching test file. Remove a former test file if it becomes empty.
- Keep the test count proportional to the function. If one test covers the behavior, write one test.
- When asserting `neverthrow` `Result` values, prefer `assertOk` and `assertErr` from `@flowlens/common/testing` over raw boolean assertions such as `assert.equal(result.isErr(), true)`.
- After `assertOk(result)` or `assertErr(result)`, assert against `result.value` or `result.error` directly.


### File and Suite Layout

For functions defined in `packages/common/src/fs/index.ts`, use only
`packages/common/src/fs/index.test.ts`. Do not create files such as
`is-within-directory.test.ts` or `find-workspace-root.test.ts`.

```ts
// packages/common/src/fs/index.test.ts
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { findWorkspaceRoot, isWithinDirectory } from './index.js';

describe('isWithinDirectory', () => {
  it('includes the directory itself', () => {
    const directory = path.resolve('workspace');
    assert.equal(isWithinDirectory(directory, directory), true);
  });
});

describe('findWorkspaceRoot', () => {
  // All findWorkspaceRoot test cases go here, in this same file.
});
```

### Result Assertions

Example:

```ts
import assert from 'node:assert/strict';
import { assertErr, assertOk } from '@flowlens/common/testing';

describe("create", () => {
  it("creates the expected value", () => {
    const result = create();

    assertOk(result);
    assert.equal(result.value.id, "fixture-id");
  });

  it("returns validation-failed for invalid input", () => {
    const result = create({ id: "" });

    assertErr(result);
    assert.deepEqual(result.error, { reason: "validation-failed" });
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
