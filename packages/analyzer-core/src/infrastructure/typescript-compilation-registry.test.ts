import { assertErr, assertOk } from '@flowlens/common/testing';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ScriptTarget } from 'typescript-native/ast';
import { NativeLanguageServer } from './native-language-server.js';
import { TypeScriptCompilationRegistry } from './typescript-compilation-registry.js';

describe('TypeScriptCompilationRegistry', () => {
  let registry: TypeScriptCompilationRegistry;
  let root: string;
  let config: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-registry-'));
    await cp(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    await mkdir(path.join(root, '.git'));
    config = path.join(root, 'core/tsconfig.json');
    const registryCreationResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(registryCreationResult);
    registry = registryCreationResult.value;
  });

  afterEach(async () => {
    await registry.clear();
    await rm(root, { recursive: true, force: true });
  });

  async function recreateRegistry(): Promise<void> {
    await registry.clear();
    const result = await TypeScriptCompilationRegistry.create(root);
    assertOk(result);
    registry = result.value;
  }

  it('shares native sessions and preserves configuration, aliases, and unbuilt references', async t => {
    const acquireSnapshot = t.mock.method(NativeLanguageServer.prototype, 'getSnapshot');
    await recreateRegistry();
    assert.equal(acquireSnapshot.mock.callCount(), 1);
    const [server, duplicateServer] = await Promise.all([registry.getServer(), registry.getServer()]);
    assert.equal(server, duplicateServer);
    const selectedResult = await registry.getProject(config);
    assertOk(selectedResult);
    const selected = selectedResult.value;
    const duplicateResult = await registry.getProject(config);
    assertOk(duplicateResult);
    const duplicate = duplicateResult.value;
    assert.equal(selected, duplicate);
    const compilations = await registry.getProjects();
    assert.equal(compilations.length, 2);
    assert.equal(compilations[0], selected);
    const sibling = compilations[1]!;
    assert.equal(await registry.getServer(), server);
    const siblingResult = await registry.getProject(sibling.configFileName!);
    assertOk(siblingResult);
    assert.equal(siblingResult.value, sibling);
    assert.equal(selected.program.getCompilerOptions().target, ScriptTarget.ES2022);
    assert.equal(sibling.program.getCompilerOptions().target, ScriptTarget.ES2023);
    assert.deepEqual(sibling.program.getCompilerOptions().paths, { '@fixture/core/*': ['../core/src/*'] });
    const adapterPath = path.join(root, 'infrastructure/src/adapter.ts');
    assert.equal(await selected.program.getSourceFile(adapterPath), undefined);
    assert.ok(await sibling.program.getSourceFile(adapterPath));
    assert.ok(await sibling.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
    assert.deepEqual(await sibling.program.getSemanticDiagnostics(), []);
    assert.deepEqual(await registry.getProjects(), compilations);
    assert.equal(acquireSnapshot.mock.callCount(), 1);
    const snapshot = await acquireSnapshot.mock.calls[0]!.result;
    assert.ok(snapshot);
    assert.equal(snapshot.getConfiguredProject(config), selected);
    assert.equal(snapshot.getConfiguredProject(sibling.configFileName!), sibling);
  });

  it('selects the compiler default from the existing snapshot, including overlapping projects', async t => {
    const acquireSnapshot = t.mock.method(NativeLanguageServer.prototype, 'getSnapshot');
    await recreateRegistry();
    const snapshot = await acquireSnapshot.mock.calls[0]!.result;
    assert.ok(snapshot);
    const sourcePath = path.join(root, 'core/src/ports.ts');
    const core = await registry.getProject(config);
    assertOk(core);
    const selected = await registry.getProjectForFile(sourcePath);
    assertOk(selected);
    assert.equal(selected.value, core.value);
    assert.equal(selected.value, await snapshot.getDefaultProjectForFile(sourcePath));

    const missingPath = path.join(root, 'unowned.ts');
    const missing = await registry.getProjectForFile(missingPath);
    assertErr(missing);
    assert.deepEqual(missing.error, { reason: 'project-not-found', filePath: missingPath });
    assertErr(await registry.getProjectForFile(path.join(root, '../outside.ts')));
    assert.equal(acquireSnapshot.mock.callCount(), 1);
    await registry.clear();
    await assert.rejects(registry.getProjectForFile(sourcePath), /cleared/);

    await writeFile(path.join(root, 'core/tsconfig.test.json'), JSON.stringify({ extends: './tsconfig.json', files: ['src/ports.ts'] }));
    await recreateRegistry();
    const overlappingSnapshot = await acquireSnapshot.mock.calls[1]!.result;
    assert.ok(overlappingSnapshot);
    const overlappingDefault = await overlappingSnapshot.getDefaultProjectForFile(sourcePath);
    assert.ok(overlappingDefault);
    const overlappingResult = await registry.getProjectForFile(sourcePath);
    assertOk(overlappingResult);
    assert.equal(overlappingResult.value, overlappingDefault);
    assert.equal(acquireSnapshot.mock.callCount(), 2);
  });

  it('includes a referenced custom configuration in the shared snapshot and honors extends', async () => {
    const custom = path.join(root, 'custom/project.json');
    await mkdir(path.dirname(custom));
    await writeFile(path.join(root, 'custom/base.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022' } }));
    await writeFile(custom, JSON.stringify({ extends: './base.json', files: ['entry.ts'] }));
    await writeFile(path.join(root, 'custom/entry.ts'), 'export const value = 1;');
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './custom/project.json' }] }));
    await recreateRegistry();
    const projectResult = await registry.getProject(custom);
    assertOk(projectResult);
    const project = projectResult.value;
    assert.equal(project.program.getCompilerOptions().strict, true);
    assert.equal(project.program.getCompilerOptions().target, ScriptTarget.ES2022);
    assert.ok(await project.program.getSourceFile(path.join(root, 'custom/entry.ts')));
    const relativeResult = await registry.getProject(path.relative(process.cwd(), custom));
    assertOk(relativeResult);
    assert.equal(relativeResult.value, project);
    assert.ok((await registry.getProjects()).includes(project));
  });

  it('isolates workspaces and disposes snapshots and servers once when cleared', async t => {
    const other = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-other-'));
    t.after(() => rm(other, { recursive: true, force: true }));
    await cp(path.resolve('src/fixtures/workspace'), other, { recursive: true });
    await mkdir(path.join(other, '.git'));
    const selectedResult = await registry.getProject(config);
    assertOk(selectedResult);
    const selected = selectedResult.value;
    const otherRegistryCreationResult = await TypeScriptCompilationRegistry.create(other);
    assertOk(otherRegistryCreationResult);
    const otherRegistry = otherRegistryCreationResult.value;
    t.after(() => otherRegistry.clear());
    const secondResult = await otherRegistry.getProject(path.join(other, 'core/tsconfig.json'));
    assertOk(secondResult);
    const second = secondResult.value;
    const outsideResult = await registry.getProject(path.join(other, 'core/tsconfig.json'));
    assertErr(outsideResult);
    assert.deepEqual(outsideResult.error, { reason: 'config-outside-workspace', configPath: path.join(other, 'core/tsconfig.json') });
    const server = await registry.getServer();
    assert.notEqual(server, await otherRegistry.getServer());
    assert.equal((await registry.getProjects()).length, 2);
    const dispose = t.mock.method(server, 'dispose');
    const clearing = registry.clear();
    assert.equal(registry.clear(), clearing);
    await assert.rejects(registry.getServer(), /cleared/);
    await assert.rejects(registry.getProject(config), /cleared/);
    await assert.rejects(registry.getProjects(), /cleared/);
    await clearing;
    assert.equal(dispose.mock.callCount(), 1);
    await assert.rejects(selected.program.getSourceFile(config), /Client is closed/);
    assert.ok(await second.program.getSourceFile(path.join(other, 'core/src/ports.ts')));
    await assert.rejects(server.getSnapshot(), /disposed/);
    const registryCreationResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(registryCreationResult);
    registry = registryCreationResult.value;
    const refreshedResult = await registry.getProject(config);
    assertOk(refreshedResult);
    const refreshed = refreshedResult.value;
    assert.notEqual(refreshed, selected);
    assert.notEqual(await registry.getServer(), server);
  });

  it('reports malformed configs with context and retries without caching failures', async () => {
    const broken = path.join(root, 'tsconfig.broken.json');
    await writeFile(broken, '{ "compilerOptions": { "target": "not-a-target" } }');
    const brokenResult = await TypeScriptCompilationRegistry.create(root);
    assertErr(brokenResult);
    assert.equal(brokenResult.error.reason, 'invalid-config');
    assert.ok('configPath' in brokenResult.error);
    assert.equal(brokenResult.error.configPath, broken);
    assert.ok('cause' in brokenResult.error);
    assert.match(brokenResult.error.cause.message, /target/);
    await writeFile(broken, JSON.stringify({ files: ['core/src/ports.ts'] }));
    await recreateRegistry();
    const projectResult = await registry.getProject(broken);
    assertOk(projectResult);
    const project = projectResult.value;
    assert.ok(await project.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
  });

  it('keeps unexpected configuration parsing failures as exceptions', async t => {
    const transportError = new Error('connection closed');
    t.mock.method(NativeLanguageServer.prototype, 'parseConfig', async () => { throw transportError; });

    await assert.rejects(TypeScriptCompilationRegistry.create(root), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.cause instanceof Error);
      assert.equal(error.cause.cause, transportError);
      return true;
    });
  });

  it('discovers referenced custom configs and configs in custom output directories while excluding empty shared configs', async () => {
    await mkdir(path.join(root, 'custom'));
    await mkdir(path.join(root, 'generated'));
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      files: [], references: [{ path: './custom/project.json' }], compilerOptions: { outDir: './generated' },
    }));
    await writeFile(path.join(root, 'custom/project.json'), JSON.stringify({ files: ['entry.ts'], compilerOptions: { composite: true } }));
    await writeFile(path.join(root, 'custom/entry.ts'), 'export const value = 1;');
    await writeFile(path.join(root, 'generated/tsconfig.json'), JSON.stringify({ files: ['output.ts'] }));
    await writeFile(path.join(root, 'generated/output.ts'), 'export const generated = 1;');
    await recreateRegistry();
    const compilations = await registry.getProjects();
    assert.deepEqual(compilations.map(project => path.relative(root, project.configFileName!)), [
      'core/tsconfig.json', 'custom/project.json', 'generated/tsconfig.json', 'infrastructure/tsconfig.json',
    ]);
  });

  it('preserves compilation and partial snapshot cleanup failures without caching the failed load', async t => {
    const nativeLanguageServer = await registry.getServer();
    const snapshot = await nativeLanguageServer.getSnapshot({ openProjects: [config], ensurePrograms: true });
    const compilationError = new Error('configured project unavailable');
    const cleanupError = new Error('snapshot cleanup failed');
    const getSnapshot = t.mock.method(NativeLanguageServer.prototype, 'getSnapshot', async () => snapshot);
    t.mock.method(snapshot, 'getConfiguredProject', () => { throw compilationError; });
    const disposeSnapshot = snapshot.dispose.bind(snapshot);
    const cleanup = t.mock.method(snapshot, 'dispose', async () => {
      await disposeSnapshot();
      throw cleanupError;
    });

    await assert.rejects(TypeScriptCompilationRegistry.create(root), error => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 2);
      assert.ok(error.errors[0] instanceof Error);
      assert.equal(error.errors[0].cause, compilationError);
      assert.equal(error.errors[1], cleanupError);
      return true;
    });
    assert.equal(cleanup.mock.callCount(), 1);
    assert.equal(snapshot.isDisposed(), true);
    getSnapshot.mock.restore();
    await recreateRegistry();
    const projectResult = await registry.getProject(config);
    assertOk(projectResult);
    const project = projectResult.value;
    assert.ok(await project.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
  });

  it('discovers newly added projects in a fresh registry', async () => {
    assert.equal((await registry.getProjects()).length, 2);
    await mkdir(path.join(root, 'extra'));
    await writeFile(path.join(root, 'extra/tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
    await writeFile(path.join(root, 'extra/entry.ts'), 'export const extra = 1;');
    assert.equal((await registry.getProjects()).length, 2);
    const lateProject = await registry.getProject(path.join(root, 'extra/tsconfig.json'));
    assertErr(lateProject);
    assert.deepEqual(lateProject.error, { reason: 'config-not-in-snapshot', configPath: path.join(root, 'extra/tsconfig.json') });
    await registry.clear();
    const registryCreationResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(registryCreationResult);
    registry = registryCreationResult.value;
    assert.equal((await registry.getProjects()).length, 3);
  });
});

describe('clear', () => {
  it('disposes the shared snapshot once and attempts server disposal and retains failures on repeated calls', async t => {
    const workspaceRoot = path.resolve('src/fixtures/workspace');
    const acquireSnapshot = t.mock.method(NativeLanguageServer.prototype, 'getSnapshot');
    const registryCreationResult = await TypeScriptCompilationRegistry.create(workspaceRoot);
    assertOk(registryCreationResult);
    const registry = registryCreationResult.value;
    const nativeLanguageServer = await registry.getServer();
    const firstCompilationResult = await registry.getProject(path.join(workspaceRoot, 'core/tsconfig.json'));
    assertOk(firstCompilationResult);
    const secondCompilationResult = await registry.getProject(path.join(workspaceRoot, 'infrastructure/tsconfig.json'));
    assertOk(secondCompilationResult);
    assert.equal(acquireSnapshot.mock.callCount(), 1);
    const snapshot = await acquireSnapshot.mock.calls[0]!.result;
    assert.ok(snapshot);
    const snapshotError = new Error('snapshot cleanup failed');
    const serverError = new Error('server cleanup failed');
    const disposeFirstSnapshot = snapshot.dispose.bind(snapshot);
    const disposeServer = nativeLanguageServer.dispose.bind(nativeLanguageServer);
    const firstCleanup = t.mock.method(snapshot, 'dispose', async () => {
      await disposeFirstSnapshot();
      throw snapshotError;
    });
    const serverCleanup = t.mock.method(nativeLanguageServer, 'dispose', async () => {
      await disposeServer();
      throw serverError;
    });
    const verifyFailure = (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [snapshotError, serverError]);
      return true;
    };
    t.after(() => assert.rejects(registry.clear(), verifyFailure));

    const clearing = registry.clear();
    assert.equal(registry.clear(), clearing);
    await assert.rejects(clearing, verifyFailure);
    await assert.rejects(registry.getProjects(), /cleared/);
    assert.equal(firstCleanup.mock.callCount(), 1);
    assert.equal(serverCleanup.mock.callCount(), 1);
    assert.equal(snapshot.isDisposed(), true);
  });
});
