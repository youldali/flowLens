# Test Guidelines

## Unit Test Structure

- Use Node's built-in test runner.
- Each unit test file should have one top-level `describe` block named after the function under test.
- Add the unit tests for that function inside the function-level `describe` block.
- If one unit test is enough to cover the function behavior, keep the file to one unit test.

Example:

```ts
describe("create", () => {
  it("creates the expected value", () => {
    // assertions
  });
});
```

## Fixtures

- Add test fixtures in `src/fixtures`.
- Create domain elements such as nodes or edges through fixtures when a test needs them.
- Fixture files must leverage the `createFixture` function exported by `@flowlens/test-utils`.
- Fixture files should expose a `create` function for the matching domain type.
- See `src/fixtures/edge.ts` for an example.

Example:

```ts
// src/fixtures/edge.ts
import type { Edge } from '../edge.js';
import { createFixture } from '@flowlens/test-utils';

const edgeFixture: Edge = {
  id: "source-node->target-node:calls",
  source: "source-node",
  target: "target-node",
  type: "calls",
};

export const create = createFixture<Edge>(edgeFixture);
```
