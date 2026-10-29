import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { NativeLanguageServer } from '#infrastructure/native-language-server';
import { isCallableTypeMemberDeclarationNode } from '#domain/node';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { GraphAdapter } from '#adapters/graph-adapter';
import { TypeScriptCompilationRegistry } from '#infrastructure/typescript-compilation-registry';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { WorkspaceAnalysisService } from './workspace-analysis-service.js';

describe('analyze', () => {
  let directory: string;
  let workspaceRoots: string[];

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'flowlens-workspace-analysis-'));
    workspaceRoots = ['first', 'second'].map(name => path.join(directory, name));

    for (const workspaceRoot of workspaceRoots) {
      await mkdir(path.join(workspaceRoot, '.git'), { recursive: true });
      await writeFile(path.join(workspaceRoot, 'tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
      await writeFile(path.join(workspaceRoot, 'entry.ts'), 'export function entry() { return 1; }');
    }
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('builds function graphs, creates fresh compilation registries, and isolates repositories', async t => {
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    t.after(() => workspaceAnalysisService.dispose());
    const createGraphAdapter = t.mock.method(GraphAdapter, 'create');
    const createNativeServer = t.mock.method(NativeLanguageServer, 'create');
    const clearRegistry = t.mock.method(TypeScriptCompilationRegistry.prototype, 'clear');
    const firstFilePath = path.join(workspaceRoots[0]!, 'entry.ts');
    const secondFilePath = path.join(workspaceRoots[1]!, 'entry.ts');
    const graphResults = await Promise.all([
      workspaceAnalysisService.analyze(firstFilePath, 20),
      workspaceAnalysisService.analyze(firstFilePath, 20),
      workspaceAnalysisService.analyze(secondFilePath, 20),
    ]);

    for (const [index, graphResult] of graphResults.entries()) {
      assertOk(graphResult);
      const expectedFilePath = index === 2 ? secondFilePath : firstFilePath;
      assert.ok(graphResult.value.nodes.some(node => node.kind === 'functionDeclaration' && node.name === 'entry'));
      assert.ok(graphResult.value.nodes.every(node => node.filePath === expectedFilePath));
    }

    assertOk(await workspaceAnalysisService.analyze(firstFilePath, 20));
    const compilationRegistries = createGraphAdapter.mock.calls.map(call => call.arguments[1]);
    const firstRegistries = compilationRegistries.filter(registry => registry.root === workspaceRoots[0]);
    assert.equal(firstRegistries.length, 3);
    assert.equal(new Set(compilationRegistries).size, 4);
    const nativeServers = await Promise.all(createNativeServer.mock.calls.map(call => call.result));
    assert.equal(new Set(nativeServers).size, 4);
    assert.equal(clearRegistry.mock.callCount(), 4);

    for (const compilationRegistry of compilationRegistries) {
      await assert.rejects(compilationRegistry.getServer(), /cleared/);
    }

    assert.ok(compilationRegistries.some(registry => registry.root === workspaceRoots[1] && registry !== firstRegistries[0]));
    const missingNode = await workspaceAnalysisService.analyze(firstFilePath, 1_000_000);
    assertErr(missingNode);
    assert.equal(missingNode.error.reason, 'node-not-found');
    assert.equal(clearRegistry.mock.callCount(), 5);
  });

  it('analyzes a whole file without an offset and preserves the graph after shutdown', async t => {
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    t.after(() => workspaceAnalysisService.dispose());
    const filePath = path.join(workspaceRoots[0]!, 'entry.ts');
    const sourceText = 'export function first() { return 1; }\nexport function second() { return 2; }';
    await writeFile(filePath, sourceText);
    const analysisResult = await workspaceAnalysisService.analyze(filePath);
    assertOk(analysisResult);
    const functionNames = analysisResult.value.nodes
      .filter(node => node.kind === 'functionDeclaration').map(node => node.name);
    assert.ok(functionNames.includes('first'));
    assert.ok(functionNames.includes('second'));

    await workspaceAnalysisService.dispose();
    await writeFile(filePath, 'export function changed() {}');
    assert.deepEqual(analysisResult.value.nodes
      .filter(node => node.kind === 'functionDeclaration').map(node => node.name), functionNames);
  });

  it('returns missing configuration and propagates unexpected compiler failures', async t => {
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    t.after(() => workspaceAnalysisService.dispose());
    const compilerError = new Error('compiler failed');
    const createGraphAdapter = t.mock.method(GraphAdapter, 'create', async () => { throw compilerError; });
    const emptyDirectory = path.join(directory, 'empty');
    await mkdir(emptyDirectory);
    const missingConfig = await workspaceAnalysisService.analyze(path.join(emptyDirectory, 'entry.ts'), 0);

    assertErr(missingConfig);
    assert.equal(missingConfig.error.reason, 'tsconfig-not-found');
    assert.equal(createGraphAdapter.mock.callCount(), 0);
    await assert.rejects(workspaceAnalysisService.analyze(path.join(workspaceRoots[0]!, 'entry.ts'), 20), error => error === compilerError);
  });

  it('analyzes a standalone project with only a config variant and reports unowned files', async t => {
    const root = path.join(directory, 'standalone');
    const sourceDirectory = path.join(root, 'src');
    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(path.join(root, 'tsconfig.app.json'), JSON.stringify({ files: ['src/entry.ts'] }));
    const filePath = path.join(sourceDirectory, 'entry.ts');
    await writeFile(filePath, 'export function entry() { return 1; }');
    const service = new WorkspaceAnalysisService();
    t.after(() => service.dispose());

    const result = await service.analyze(filePath);
    assertOk(result);
    assert.ok(result.value.nodes.some(node => node.name === 'entry'));

    const excludedFile = path.join(sourceDirectory, 'excluded.ts');
    await writeFile(excludedFile, 'export const excluded = 1;');
    const excludedResult = await service.analyze(excludedFile);
    assertErr(excludedResult);
    assert.deepEqual(excludedResult.error, { reason: 'project-not-found', filePath: excludedFile });
  });

  it('returns invalid configuration results and preserves them if cleanup fails', async t => {
    const workspaceRoot = workspaceRoots[0]!;
    const configPath = path.join(workspaceRoot, 'tsconfig.json');
    await writeFile(configPath, JSON.stringify({ compilerOptions: { target: 'invalid-target' }, files: ['entry.ts'] }));
    const service = new WorkspaceAnalysisService();
    t.after(() => service.dispose());
    const clearRegistry = NativeLanguageServer.prototype.dispose;
    const cleanup = t.mock.method(NativeLanguageServer.prototype, 'dispose');
    const result = await service.analyze(path.join(workspaceRoot, 'entry.ts'));

    assertErr(result);
    assert.equal(result.error.reason, 'invalid-config');
    assert.ok('configPath' in result.error);
    assert.equal(result.error.configPath, configPath);
    assert.equal(cleanup.mock.callCount(), 1);
    const registry = cleanup.mock.calls[0]!.this;
    assert.ok(registry instanceof NativeLanguageServer);
    await assert.rejects(registry.getSnapshot(), /disposed/);

    const cleanupError = new Error('cleanup failed');
    cleanup.mock.mockImplementation(async function (this: NativeLanguageServer) {
      await clearRegistry.call(this);
      throw cleanupError;
    });
    await assert.rejects(service.analyze(path.join(workspaceRoot, 'entry.ts')), error => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0].reason, 'invalid-config');
      assert.equal(error.errors[1], cleanupError);
      return true;
    });
  });

  it('propagates native server initialization failures without creating an adapter', async t => {
    const initializationError = new Error('native server initialization failed');
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    t.after(() => workspaceAnalysisService.dispose());
    t.mock.method(NativeLanguageServer, 'create', async () => { throw initializationError; });
    const createGraphAdapter = t.mock.method(GraphAdapter, 'create');

    await assert.rejects(workspaceAnalysisService.analyze(path.join(workspaceRoots[0]!, 'entry.ts')), error => error === initializationError);
    assert.equal(createGraphAdapter.mock.callCount(), 0);
  });

  it('clears resources after adapter or graph failures and preserves cleanup failures', async t => {
    const filePath = path.join(workspaceRoots[0]!, 'entry.ts');

    for (const failureStage of ['adapter', 'graph', 'cleanup'] as const) {
      await t.test(failureStage, async t => {
        const analysisError = new Error(`${failureStage} failed`);
        const cleanupError = new Error('cleanup failed');
        const workspaceAnalysisService = new WorkspaceAnalysisService();
        t.after(() => workspaceAnalysisService.dispose());
        const clearRegistry = TypeScriptCompilationRegistry.prototype.clear;
        const cleanup = t.mock.method(TypeScriptCompilationRegistry.prototype, 'clear', async function (this: TypeScriptCompilationRegistry) {
          await clearRegistry.call(this);
          if (failureStage === 'graph' || failureStage === 'cleanup') throw cleanupError;
        });
        const failAnalysis = async () => { throw analysisError; };
        if (failureStage === 'adapter') t.mock.method(GraphAdapter, 'create', failAnalysis);
        if (failureStage === 'graph') t.mock.method(GraphAdapter.prototype, 'analyze', failAnalysis);

        await assert.rejects(workspaceAnalysisService.analyze(filePath), error => {
          if (failureStage === 'graph') {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [analysisError, cleanupError]);
          } else {
            assert.equal(error, failureStage === 'cleanup' ? cleanupError : analysisError);
          }

          return true;
        });
        assert.equal(cleanup.mock.callCount(), 1);
        const compilationRegistry = cleanup.mock.calls[0]!.this;
        assert.ok(compilationRegistry instanceof TypeScriptCompilationRegistry);
        await assert.rejects(compilationRegistry.getServer(), /cleared/);
      });
    }
  });

  it('refreshes saved source and dependency changes on subsequent analyses', async t => {
    const service = new WorkspaceAnalysisService();
    t.after(() => service.dispose());
    const root = workspaceRoots[0]!;
    const file = path.join(root, 'entry.ts');
    const dependency = path.join(root, 'dependency.ts');
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'NodeNext' }, files: ['entry.ts'] }));
    await writeFile(dependency, 'export function original() { return 1; }');
    const entryText = "import { original } from './dependency.js'; export function entry() { return original(); }";
    await writeFile(file, entryText);
    const original = await service.analyze(file, entryText.indexOf('return'));
    assertOk(original);
    assert.ok(original.value.nodes.some(node => node.name === 'original' && node.kind === 'functionDeclaration'));
    const changedText = entryText.replaceAll('original', 'changed');
    await writeFile(file, changedText);
    await writeFile(dependency, 'export function changed() { return 2; }');
    const changed = await service.analyze(file, changedText.indexOf('return'));
    assertOk(changed);
    assert.ok(changed.value.nodes.some(node => node.name === 'changed' && node.kind === 'functionDeclaration'));
    assert.ok(!changed.value.nodes.some(node => node.name === 'original'));
    assert.ok(original.value.nodes.some(node => node.name === 'original'));
  });

  it('refreshes saved edits, additions, deletions, dependent semantics and configuration', async t => {
    const root = workspaceRoots[0]!;
    fs.cpSync(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    t.after(() => workspaceAnalysisService.dispose());
    const entry = path.join(root, 'core/src/use-case.ts');
    const implementation = path.join(root, 'infrastructure/src/adapter.ts');
    const analyze = async () => {
      const result = await workspaceAnalysisService.analyze(entry);
      assertOk(result);
      return result.value;
    };
    const candidates = (graph: Awaited<ReturnType<typeof analyze>>) => graph.nodes
      .filter(isCallableTypeMemberDeclarationNode).flatMap(node => node.implementations);
    const initial = await analyze();
    assert.equal(candidates(initial).length, 1);
    const original = fs.readFileSync(implementation, 'utf8');
    fs.writeFileSync(implementation, '\n\n' + original);
    const moved = await analyze();
    assert.equal(candidates(moved)[0]!.offset, candidates(initial)[0]!.offset + 2);
    const additional = path.join(root, 'infrastructure/src/new.ts');
    fs.writeFileSync(additional, "import type { PlainCustomerRepository } from '@fixture/core/ports.js';\nexport class Added implements PlainCustomerRepository { list(): string[] { return []; } }");
    assert.equal(candidates(await analyze()).length, 2);
    fs.unlinkSync(additional);
    assert.equal(candidates(await analyze()).length, 1);
    fs.writeFileSync(path.join(root, 'infrastructure/tsconfig.json'), JSON.stringify({ include: ['no-match/**/*.ts'] }));
    assert.equal(candidates(await analyze()).length, 0);
    const ports = path.join(root, 'core/src/ports.ts');
    fs.writeFileSync(ports, fs.readFileSync(ports, 'utf8').replace('list()', 'find()'));
    fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace('plainRepository.list()', 'plainRepository.find()'));
    assert.ok((await analyze()).nodes.some(node => node.kind === 'callableTypeMemberDeclaration' && node.name === 'find'));
  });

});

describe('dispose', () => {
  it('waits through initialization, analysis, and cleanup while rejecting new work', async t => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'flowlens-shutdown-'));
    await writeFile(path.join(workspaceRoot, 'tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
    const filePath = path.join(workspaceRoot, 'entry.ts');
    await writeFile(filePath, 'export function entry() { return 1; }');
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    const initializationStarted = Promise.withResolvers<void>();
    const initializationGate = Promise.withResolvers<void>();
    const analysisStarted = Promise.withResolvers<void>();
    const analysisGate = Promise.withResolvers<void>();
    const cleanupStarted = Promise.withResolvers<void>();
    const cleanupGate = Promise.withResolvers<void>();
    t.after(async () => {
      initializationGate.resolve();
      analysisGate.resolve();
      cleanupGate.resolve();
      await workspaceAnalysisService.dispose();
      await rm(workspaceRoot, { recursive: true, force: true });
    });
    const createRegistry = TypeScriptCompilationRegistry.create;
    t.mock.method(TypeScriptCompilationRegistry, 'create', async (root: string) => {
      initializationStarted.resolve();
      await initializationGate.promise;
      return createRegistry(root);
    });
    const analyzeGraph = GraphAdapter.prototype.analyze;
    t.mock.method(GraphAdapter.prototype, 'analyze', async function (this: GraphAdapter, entryFilePath: string, offset?: number) {
      analysisStarted.resolve();
      await analysisGate.promise;
      return analyzeGraph.call(this, entryFilePath, offset);
    });
    const clearRegistry = TypeScriptCompilationRegistry.prototype.clear;
    t.mock.method(TypeScriptCompilationRegistry.prototype, 'clear', async function (this: TypeScriptCompilationRegistry) {
      cleanupStarted.resolve();
      await cleanupGate.promise;
      await clearRegistry.call(this);
    });
    const analysis = workspaceAnalysisService.analyze(filePath);
    await initializationStarted.promise;
    const closing = workspaceAnalysisService.dispose();
    let shutdownCompleted = false;
    void closing.then(() => { shutdownCompleted = true; });
    assert.equal(workspaceAnalysisService.dispose(), closing);
    await assert.rejects(workspaceAnalysisService.analyze(filePath), /shutting down/);
    assert.equal(shutdownCompleted, false);

    initializationGate.resolve();
    await analysisStarted.promise;
    assert.equal(shutdownCompleted, false);
    analysisGate.resolve();
    await cleanupStarted.promise;
    assert.equal(shutdownCompleted, false);
    cleanupGate.resolve();
    assertOk(await analysis);
    await closing;
    assert.equal(shutdownCompleted, true);
  });

  it('waits for failing analysis cleanup without replaying failures during shutdown', async t => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'flowlens-failed-shutdown-'));
    const filePath = path.join(workspaceRoot, 'entry.ts');
    await writeFile(path.join(workspaceRoot, 'tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
    await writeFile(filePath, 'export function entry() {}');
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    const analysisStarted = Promise.withResolvers<void>();
    const analysisGate = Promise.withResolvers<void>();
    t.after(async () => {
      analysisGate.resolve();
      await workspaceAnalysisService.dispose();
      await rm(workspaceRoot, { recursive: true, force: true });
    });
    const analysisError = new Error('analysis failed');
    const cleanupError = new Error('cleanup failed');
    t.mock.method(GraphAdapter.prototype, 'analyze', async () => {
      analysisStarted.resolve();
      await analysisGate.promise;
      throw analysisError;
    });
    const clearRegistry = TypeScriptCompilationRegistry.prototype.clear;
    const cleanup = t.mock.method(TypeScriptCompilationRegistry.prototype, 'clear', async function (this: TypeScriptCompilationRegistry) {
      await clearRegistry.call(this);
      throw cleanupError;
    });
    const analysisRejection = assert.rejects(workspaceAnalysisService.analyze(filePath), error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [analysisError, cleanupError]);
      return true;
    });
    await analysisStarted.promise;
    const closing = workspaceAnalysisService.dispose();
    assert.equal(cleanup.mock.callCount(), 0);
    analysisGate.resolve();
    await analysisRejection;
    await closing;
    assert.equal(cleanup.mock.callCount(), 1);
  });
});
