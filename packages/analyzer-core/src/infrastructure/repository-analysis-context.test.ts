import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { assertOk } from '@flowlens/common/testing';
import { GraphAdapter } from '../adapters/graph-adapter.js';
import { isCallableTypeMemberDeclarationNode } from '../domain/node.js';
import { RepositoryAnalysisContext } from './repository-analysis-context.js';

describe('RepositoryAnalysisContext', () => {
  it('isolates graph analysis, implementations, and cleanup between repositories', async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'flowlens-contexts-'));
    const contexts = ['first', 'second'].map(name => new RepositoryAnalysisContext(path.join(directory, name)));
    t.after(async () => {
      try {
        await Promise.all(contexts.map(context => context.clear()));
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    for (const context of contexts) {
      await cp(path.resolve('src/fixtures/workspace'), context.root, { recursive: true });
      await mkdir(path.join(context.root, '.git'));
    }

    const [first, second] = contexts as [RepositoryAnalysisContext, RepositoryAnalysisContext];
    const analyze = async (context: RepositoryAnalysisContext) => {
      const adapter = await GraphAdapter.create(path.join(context.root, 'core/tsconfig.json'), context);
      assertOk(await adapter.fromFile(path.join(context.root, 'core/src/use-case.ts')));
      const implementations = adapter.extract().nodes.filter(isCallableTypeMemberDeclarationNode).flatMap(node => node.implementations);
      assert.equal(implementations.length, 1);
      assert.equal(implementations[0]!.filePath, path.join(context.root, 'infrastructure/src/adapter.ts'));
      assertOk(adapter.getNavigableSource(implementations[0]!.filePath));
      return adapter;
    };
    await Promise.all(contexts.map(analyze));
    const firstService = await first.nativeRegistry.getService(path.join(first.root, 'core/tsconfig.json'));
    const secondService = await second.nativeRegistry.getService(path.join(second.root, 'core/tsconfig.json'));
    assert.notEqual(firstService.server, secondService.server);
    await first.clear();
    await first.clear();
    assert.equal(firstService.snapshot.isDisposed(), true);
    assert.equal(secondService.snapshot.isDisposed(), false);
    await analyze(second);
    await analyze(first);
    const refreshed = await first.nativeRegistry.getService(path.join(first.root, 'core/tsconfig.json'));
    assert.notEqual(refreshed.server, firstService.server);
  });

  it('attempts both registries and preserves both cleanup failures', async t => {
    const context = new RepositoryAnalysisContext('.');
    const nativeFailure = new Error('native cleanup failed');
    const legacyFailure = new Error('legacy cleanup failed');
    t.mock.method(context.nativeRegistry, 'clear', async () => { throw nativeFailure; });
    const legacyClear = t.mock.method(context.legacyRegistry, 'clear', () => { throw legacyFailure; });

    await assert.rejects(context.clear(), error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [nativeFailure, legacyFailure]);
      return true;
    });
    assert.equal(legacyClear.mock.callCount(), 1);
  });
});
