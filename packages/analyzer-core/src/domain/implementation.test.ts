import assert from 'node:assert/strict';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import { buildImplementation } from '#domain/implementation';
import { create, createImplementationLocation } from '#fixtures/implementation';
import { createSourceFile } from '#fixtures/native-compiler';

describe('buildImplementation', () => {
  it('extracts the selected name and resolves the source path', () => {
    const filePath = 'src/../src/adapter.ts';
    const source = createSourceFile(filePath, 'list() {}');
    const location = createImplementationLocation({ uri: pathToFileURL(filePath).href });

    assert.deepEqual(buildImplementation(source, location), create({
      filePath: path.resolve('src/adapter.ts').split(path.sep).join('/'),
    }));
  });

  it('converts CRLF lines and UTF-16 positions to offsets and one-based coordinates', () => {
    const filePath = path.resolve('src/adapter.ts');
    const source = createSourceFile(filePath, '// header\r\n/* 😀 */ list() {}');
    const location = createImplementationLocation({
      uri: pathToFileURL(filePath).href,
      range: {
        start: { line: 1, character: 9 },
        end: { line: 1, character: 13 },
      },
    });

    assert.deepEqual(buildImplementation(source, location), create({
      filePath: filePath.split(path.sep).join('/'),
      line: 2,
      column: 10,
      offset: 20,
    }));
  });

  it('uses the source basename when the location range is empty', () => {
    const filePath = path.resolve('src/adapter.ts');
    const source = createSourceFile(filePath, 'list() {}');
    const location = createImplementationLocation({
      uri: pathToFileURL(filePath).href,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    });

    assert.deepEqual(buildImplementation(source, location), create({
      name: 'adapter.ts',
      filePath: filePath.split(path.sep).join('/'),
    }));
  });
});
