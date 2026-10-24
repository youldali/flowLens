import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { GraphAdapter } from '@flowlens/analyzer-core/adapter/graph-adapter';
import { RepositoryAnalysisContext } from '@flowlens/analyzer-core/infrastructure/repository-analysis-context';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { RepositoryAnalysisService } from './repository-analysis-service.js';

describe('RepositoryAnalysisService', () => {
  let directory: string;
  let repositoryRoots: string[];

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'flowlens-extension-analysis-'));
    repositoryRoots = ['first', 'second'].map(name => path.join(directory, name));

    for (const repositoryRoot of repositoryRoots) {
      await mkdir(path.join(repositoryRoot, '.git'), { recursive: true });
      await writeFile(path.join(repositoryRoot, 'tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
      await writeFile(path.join(repositoryRoot, 'entry.ts'), 'export function entry() { return 1; }');
    }
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('builds function graphs, reuses repository contexts, and isolates repositories', async t => {
    const repositoryAnalysisService = new RepositoryAnalysisService();
    t.after(() => repositoryAnalysisService.dispose());
    const createGraphAdapter = t.mock.method(GraphAdapter, 'create');
    const firstFilePath = path.join(repositoryRoots[0]!, 'entry.ts');
    const secondFilePath = path.join(repositoryRoots[1]!, 'entry.ts');
    const graphResults = await Promise.all([
      repositoryAnalysisService.analyze(firstFilePath, 20),
      repositoryAnalysisService.analyze(firstFilePath, 20),
      repositoryAnalysisService.analyze(secondFilePath, 20),
    ]);

    for (const [index, graphResult] of graphResults.entries()) {
      assertOk(graphResult);
      const expectedFilePath = index === 2 ? secondFilePath : firstFilePath;
      assert.ok(graphResult.value.nodes.some(node => node.kind === 'functionDeclaration' && node.name === 'entry'));
      assert.ok(graphResult.value.nodes.every(node => node.filePath === expectedFilePath));
    }

    assertOk(await repositoryAnalysisService.analyze(firstFilePath, 20));
    const contexts = createGraphAdapter.mock.calls.map(call => call.arguments[1]);
    assert.equal(contexts[0], contexts[1]);
    assert.equal(contexts[0], contexts[3]);
    assert.notEqual(contexts[0], contexts[2]);
    const missingNode = await repositoryAnalysisService.analyze(firstFilePath, 1_000_000);
    assertErr(missingNode);
    assert.equal(missingNode.error.reason, 'node-not-found');
  });

  it('returns missing configuration and propagates unexpected compiler failures', async t => {
    const repositoryAnalysisService = new RepositoryAnalysisService();
    t.after(() => repositoryAnalysisService.dispose());
    const compilerError = new Error('compiler failed');
    const createGraphAdapter = t.mock.method(GraphAdapter, 'create', async () => { throw compilerError; });
    const missingConfig = await repositoryAnalysisService.analyze(path.join(directory, 'entry.ts'), 0);

    assertErr(missingConfig);
    assert.equal(missingConfig.error.reason, 'tsconfig-not-found');
    assert.equal(createGraphAdapter.mock.callCount(), 0);
    await assert.rejects(repositoryAnalysisService.analyze(path.join(repositoryRoots[0]!, 'entry.ts'), 20), error => error === compilerError);
  });

  it('waits for analyses before cleanup, rejects new work, and reports cleanup failures', async t => {
    const cleanupError = new Error('cleanup failed');
    const compilerError = new Error('compiler failed');
    const clearedRoots: string[] = [];
    const repositoryAnalysisService = new RepositoryAnalysisService();
    const analysisGate = Promise.withResolvers<void>();
    const analysesStarted = Promise.withResolvers<void>();
    let startedCount = 0;
    t.mock.method(GraphAdapter, 'create', async () => {
      if (++startedCount === 2) analysesStarted.resolve();
      await analysisGate.promise;
      throw compilerError;
    });
    t.mock.method(RepositoryAnalysisContext.prototype, 'clear', async function (this: RepositoryAnalysisContext) {
      clearedRoots.push(this.root);
      if (this.root === repositoryRoots[0]) throw cleanupError;
    });
    const analyses = repositoryRoots.map(repositoryRoot =>
      assert.rejects(repositoryAnalysisService.analyze(path.join(repositoryRoot, 'entry.ts'), 20), error => error === compilerError));
    await analysesStarted.promise;
    const closing = repositoryAnalysisService.dispose();
    const cleanupRejection = assert.rejects(closing, error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [cleanupError]);
      return true;
    });

    assert.equal(repositoryAnalysisService.dispose(), closing);
    await assert.rejects(repositoryAnalysisService.analyze(path.join(repositoryRoots[0]!, 'entry.ts'), 20), /shutting down/);
    assert.deepEqual(clearedRoots, []);
    analysisGate.resolve();
    await Promise.all(analyses);
    await cleanupRejection;
    assert.deepEqual(clearedRoots, repositoryRoots);
  });
});
