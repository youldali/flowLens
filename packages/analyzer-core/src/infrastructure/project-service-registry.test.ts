import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ScriptTarget } from 'typescript-native/ast';
import { ProjectServiceRegistry } from './project-service-registry.js';

describe('ProjectServiceRegistry', () => {
  const registry = ProjectServiceRegistry.getInstance();
  let root: string;
  let config: string;

  beforeEach(async () => {
    await registry.clear();
    root = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-registry-'));
    await cp(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    await mkdir(path.join(root, '.git'));
    config = path.join(root, 'core/tsconfig.json');
  });

  afterEach(async () => {
    await registry.clear();
    await rm(root, { recursive: true, force: true });
  });

  it('shares native sessions and preserves configuration, aliases, and unbuilt references', async () => {
    const [selected, duplicate] = await Promise.all([registry.getService(config), registry.getService(config)]);
    assert.equal(selected, duplicate);
    const services = await registry.getProjectServices(config);
    assert.equal(services.length, 2);
    assert.equal(services[0], selected);
    const sibling = services[1]!;
    assert.equal(sibling.server, selected.server);
    assert.equal(await registry.getService(sibling.projectConfig.configPath), sibling);
    assert.equal(selected.program.getCompilerOptions().target, ScriptTarget.ES2022);
    assert.equal(sibling.program.getCompilerOptions().target, ScriptTarget.ES2023);
    assert.deepEqual(sibling.program.getCompilerOptions().paths, { '@fixture/core/*': ['../core/src/*'] });
    const adapterPath = path.join(root, 'infrastructure/src/adapter.ts');
    assert.equal(await selected.program.getSourceFile(adapterPath), undefined);
    assert.ok(await sibling.program.getSourceFile(adapterPath));
    assert.ok(await sibling.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
    assert.deepEqual(await sibling.program.getSemanticDiagnostics(), []);
    assert.deepEqual(await registry.getProjectServices(config), services);
  });

  it('loads custom configurations after discovery and honors extends', async () => {
    await registry.getProjectServices(config);
    const custom = path.join(root, 'custom/project.json');
    await mkdir(path.dirname(custom));
    await writeFile(path.join(root, 'custom/base.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022' } }));
    await writeFile(custom, JSON.stringify({ extends: './base.json', files: ['entry.ts'] }));
    await writeFile(path.join(root, 'custom/entry.ts'), 'export const value = 1;');
    const service = await registry.getService(custom);
    assert.equal(service.program.getCompilerOptions().strict, true);
    assert.equal(service.program.getCompilerOptions().target, ScriptTarget.ES2022);
    assert.ok(await service.program.getSourceFile(path.join(root, 'custom/entry.ts')));
    assert.equal(await registry.getService(path.relative(process.cwd(), custom)), service);
    assert.ok((await registry.getProjectServices(config)).includes(service));
  });

  it('isolates workspaces and disposes snapshots and servers once when cleared', async t => {
    const other = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-other-'));
    t.after(() => rm(other, { recursive: true, force: true }));
    await cp(path.resolve('src/fixtures/workspace'), other, { recursive: true });
    await mkdir(path.join(other, '.git'));
    const selected = await registry.getService(config);
    const second = await registry.getService(path.join(other, 'core/tsconfig.json'));
    assert.notEqual(selected.server, second.server);
    assert.equal((await registry.getProjectServices(config)).length, 2);
    const dispose = t.mock.method(selected.server, 'dispose');
    await registry.clear();
    await registry.clear();
    assert.equal(dispose.mock.callCount(), 1);
    assert.equal(selected.snapshot.isDisposed(), true);
    assert.equal(second.snapshot.isDisposed(), true);
    await assert.rejects(selected.server.getSnapshot(), /disposed/);
    const refreshed = await registry.getService(config);
    assert.notEqual(refreshed, selected);
    assert.notEqual(refreshed.server, selected.server);
  });

  it('reports malformed configs with context and retries without caching failures', async () => {
    const broken = path.join(root, 'broken.json');
    await writeFile(broken, '{ "compilerOptions": { "target": "not-a-target" } }');
    await assert.rejects(registry.getService(broken), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /failed to create native project service/);
      assert.ok(error.cause instanceof Error);
      assert.match(error.cause.message, /target/);
      return true;
    });
    await writeFile(broken, JSON.stringify({ files: ['core/src/ports.ts'] }));
    const service = await registry.getService(broken);
    assert.ok(await service.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
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
    const services = await registry.getProjectServices(config);
    assert.deepEqual(services.map(service => path.relative(root, service.projectConfig.configPath)), [
      'core/tsconfig.json', 'custom/project.json', 'infrastructure/tsconfig.json',
    ]);
  });

  it('serializes clear after pending loads and rediscovers newly added projects', async () => {
    const pending = registry.getService(config);
    const clearing = registry.clear();
    const service = await pending;
    await clearing;
    assert.equal(service.snapshot.isDisposed(), true);
    await registry.getProjectServices(config);
    await mkdir(path.join(root, 'extra'));
    await writeFile(path.join(root, 'extra/tsconfig.json'), JSON.stringify({ files: ['entry.ts'] }));
    await writeFile(path.join(root, 'extra/entry.ts'), 'export const extra = 1;');
    assert.equal((await registry.getProjectServices(config)).length, 2);
    await registry.clear();
    assert.equal((await registry.getProjectServices(config)).length, 3);
  });
});
