import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pipe } from './index.js';

describe("pipe", () => {
  it("applies transforms from left to right", () => {
    const result = pipe(
      2,
      (value) => value + 3,
      (value) => value * 4,
    );

    assert.equal(result, 20);
  });

  it("returns the initial value when no transforms are provided", () => {
    const value = { id: "fixture" };

    assert.equal(pipe(value), value);
  });
});
