import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { identity, pipe } from './utils.js';

describe('identity', () => {
  it('returns the original value, preserving object references', () => {
    const values = ['config.json', 0, false, null, undefined, { name: 'project' }, ['project']];

    for (const value of values) {
      assert.strictEqual(identity(value), value);
    }
  });
});

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
