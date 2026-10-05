import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortAlphabetically } from './sorting.js';

describe('sortAlphabetically', () => {
  it('sorts by the selected string and preserves the order of equal values', () => {
    const values = [
      { id: 1, name: 'zebra' },
      { id: 2, name: 'apple' },
      { id: 3, name: '' },
      { id: 4, name: 'apple' },
      { id: 5, name: 'banana' },
    ];

    const sorted = values.toSorted(sortAlphabetically(value => value.name));

    assert.deepEqual(sorted.map(value => value.id), [3, 2, 4, 5, 1]);
  });

  it('sorts strings using an identity selector', () => {
    const sorted = ['pear', 'apple', 'banana'].sort(sortAlphabetically(value => value));

    assert.deepEqual(sorted, ['apple', 'banana', 'pear']);
  });
});
