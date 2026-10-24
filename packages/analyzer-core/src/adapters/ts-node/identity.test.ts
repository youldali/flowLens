import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as ts from '../../fixtures/native-compiler.js';
import { normalizePath } from '@flowlens/common/fs';

import { functionDeclarationFixture, sourceFileFixture } from '../../fixtures/ts-node.js';
import { createFileId, deriveIdFromTsNode } from './identity.js';

describe('createFileId', () => {
  it('uses the normalized source file path', () => {
    assert.equal(createFileId(sourceFileFixture), normalizePath(sourceFileFixture.fileName));
  });
});

describe('deriveIdFromTsNode', () => {
  it('combines the source file path, node kind, and text span', () => {
    assert.equal(
      deriveIdFromTsNode(functionDeclarationFixture),
      `${sourceFileFixture.fileName}:${functionDeclarationFixture.kind}:${functionDeclarationFixture.pos}:${functionDeclarationFixture.end}`,
    );
  });

  it('distinguishes a source file from a function with the same text span', () => {
    const source = ts.createSourceFile('fixture.ts', 'function run() {}', ts.ScriptTarget.Latest, true);
    const declaration = source.statements[0];

    assert.ok(declaration && ts.isFunctionDeclaration(declaration));
    assert.equal(source.pos, declaration.pos);
    assert.equal(source.end, declaration.end);
    assert.notEqual(deriveIdFromTsNode(source), deriveIdFromTsNode(declaration));
  });
});
