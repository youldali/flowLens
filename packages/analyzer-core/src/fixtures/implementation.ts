import type { ImplementationEntry, ImplementationLocation } from '#domain/implementation';
import { createFixture } from '@flowlens/test-utils';

const implementationEntryFixture: ImplementationEntry = {
  name: 'list',
  filePath: '/src/adapter.ts',
  line: 1,
  column: 1,
  offset: 0,
};

const implementationLocationFixture: ImplementationLocation = {
  uri: 'file:///src/adapter.ts',
  range: {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 4 },
  },
};

export const create = createFixture<ImplementationEntry>(implementationEntryFixture);
export const createImplementationLocation = createFixture<ImplementationLocation>(implementationLocationFixture);
