import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ScriptTarget } from 'typescript-native/ast';
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
    registry = new TypeScriptCompilationRegistry(root);
  });

  afterEach(async () => {
    await registry.clear();
    await rm(root, { recursive: true, force: true });
  });

  it('shares native sessions and preserves configuration, aliases, and unbuilt references', async () => {
    const [server, duplicateServer] = await Promise.all([registry.getServer(), registry.getServer()]);
    assert.equal(server, duplicateServer);
    const [selected, duplicate] = await Promise.all([registry.getCompilation(config), registry.getCompilation(config)]);
    assert.equal(selected, duplicate);
    const compilations = await registry.getCompilations();
    assert.equal(compilations.length, 2);
    assert.equal(compilations[0], selected);
    const sibling = compilations[1]!;
    assert.equal(await registry.getServer(), server);
    assert.equal(await registry.getCompilation(sibling.projectConfig.configPath), sibling);
    assert.equal(selected.program.getCompilerOptions().target, ScriptTarget.ES2022);
    assert.equal(sibling.program.getCompilerOptions().target, ScriptTarget.ES2023);
    assert.deepEqual(sibling.program.getCompilerOptions().paths, { '@fixture/core/*': ['../core/src/*'] });
    const adapterPath = path.join(root, 'infrastructure/src/adapter.ts');
    assert.equal(await selected.program.getSourceFile(adapterPath), undefined);
    assert.ok(await sibling.program.getSourceFile(adapterPath));
    assert.ok(await sibling.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
    assert.deepEqual(await sibling.program.getSemanticDiagnostics(), []);
    assert.deepEqual(await registry.getCompilations(), compilations);
  });

  it('loads custom configurations after discovery and honors extends', async () => {
    await registry.getCompilations();
    const custom = path.join(root, 'custom/project.json');
    await mkdir(path.dirname(custom));
    await writeFile(path.join(root, 'custom/base.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022' } }));
    await writeFile(custom, JSON.stringify({ extends: './base.json', files: ['entry.ts'] }));
    await writeFile(path.join(root, 'custom/entry.ts'), 'export const value = 1;');
    const compilationContext = await registry.getCompilation(custom);
    assert.equal(compilationContext.program.getCompilerOptions().strict, true);
    assert.equal(compilationContext.program.getCompilerOptions().target, ScriptTarget.ES2022);
    assert.ok(await compilationContext.program.getSourceFile(path.join(root, 'custom/entry.ts')));
    assert.equal(await registry.getCompilation(path.relative(process.cwd(), custom)), compilationContext);
    assert.ok((await registry.getCompilations()).includes(compilationContext));
  });

  it('isolates workspaces and disposes snapshots and servers once when cleared', async t => {
    const other = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-other-'));
    t.after(() => rm(other, { recursive: true, force: true }));
    await cp(path.resolve('src/fixtures/workspace'), other, { recursive: true });
    await mkdir(path.join(other, '.git'));
    const selected = await registry.getCompilation(config);
    const otherRegistry = new TypeScriptCompilationRegistry(other);
    t.after(() => otherRegistry.clear());
    const second = await otherRegistry.getCompilation(path.join(other, 'core/tsconfig.json'));
    await assert.rejects(registry.getCompilation(path.join(other, 'core/tsconfig.json')), /outside repository/);
    const server = await registry.getServer();
    assert.notEqual(server, await otherRegistry.getServer());
    assert.equal((await registry.getCompilations()).length, 2);
    const dispose = t.mock.method(server, 'dispose');
    await registry.clear();
    await registry.clear();
    assert.equal(dispose.mock.callCount(), 1);
    assert.equal(selected.snapshot.isDisposed(), true);
    assert.equal(second.snapshot.isDisposed(), false);
    assert.ok(await second.program.getSourceFile(path.join(other, 'core/src/ports.ts')));
    await assert.rejects(server.getSnapshot(), /disposed/);
    const refreshed = await registry.getCompilation(config);
    assert.notEqual(refreshed, selected);
    assert.notEqual(await registry.getServer(), server);
  });

  it('reports malformed configs with context and retries without caching failures', async () => {
    const broken = path.join(root, 'broken.json');
    await writeFile(broken, '{ "compilerOptions": { "target": "not-a-target" } }');
    await assert.rejects(registry.getCompilation(broken), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /failed to create native compilation context/);
      assert.ok(error.cause instanceof Error);
      assert.match(error.cause.message, /target/);
      return true;
    });
    await writeFile(broken, JSON.stringify({ files: ['core/src/ports.ts'] }));
    const compilationContext = await registry.getCompilation(broken);
    assert.ok(await compilationContext.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
  });

  it('discovers referenced custom configs while excluding output directories and empty shared configs', async () => {
    await mkdir(path.join(root, 'custom'));
    await mkdir(path.join(root, 'generated'));
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      files: [], references: [{ path: './custom/project.json' }], compilerOptions: { outDir: './generated' },
    }));
    await writeFile(path.join(root, 'custom/project.json'), JSON.stringify({ files: ['entry.ts'], compilerOptions: { composite: true } }));
    await writeFile(path.join(root, 'custom/entry.ts'), 'export const value = 1;');
    await writeFile(path.join(root, 'generated/tsconfig.json'), JSON.stringify({ files: ['output.ts'] }));
    await writeFile(path.join(root, 'generated/output.ts'), 'export const generated = 1;');
    const compilations = await registry.getCompilations();
    assert.deepEqual(compilations.map(compilationContext => path.relative(root, compilationContext.projectConfig.configPath)), [
      'core/tsconfig.json', 'custom/project.json', 'infrastructure/tsconfig.json',
    ]);
  });

  it('serializes clear after pending loads and rediscovers newly added projects', async () => {
    const pending = registry.getCompilation(config);
    const clearing = registry.clear();
    const compilationContext = await pending;
    await clearing;
    assert.equal(compilationContext.snapshot.isDisposed(), true);
    await registry.getCompilations();
    await mkdir(path.join(root, 'extra'));
    await writeFile(path.join(root, 'extra/tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
    await writeFile(path.join(root, 'extra/entry.ts'), 'export const extra = 1;');
    assert.equal((await registry.getCompilations()).length, 2);
    await registry.clear();
    assert.equal((await registry.getCompilations()).length, 3);
  });
});
