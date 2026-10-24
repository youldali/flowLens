import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as ts from 'typescript';
import { ImplementationDiscovery } from './implementation-discovery.js';
import { LegacyProjectServiceRegistry, type ProjectService } from './legacy-project-service-registry.js';

describe('LegacyProjectServiceRegistry', () => {
  let registry: LegacyProjectServiceRegistry;
  let root: string;
  let selected: ProjectService;
  let adapterPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-registry-'));
    fs.cpSync(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    registry = new LegacyProjectServiceRegistry(root);
    selected = registry.getService(path.join(root, 'core/tsconfig.json'));
    adapterPath = path.join(root, 'infrastructure/src/adapter.ts');
  });

  afterEach(() => {
    registry.clear();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lazily discovers and shares services across implementation discovery instances', (t) => {
    const readDirectory = t.mock.method(ts.sys, 'readDirectory');
    const first = new ImplementationDiscovery(selected.projectConfig.configPath, registry);
    const second = new ImplementationDiscovery(selected.projectConfig.configPath, registry);
    const pending = registry.getProjectServices();
    assert.equal(readDirectory.mock.callCount(), 0);
    assert.ok(first.getNavigableSource(adapterPath));
    const projectServices = [...pending];
    assert.equal(projectServices.length, 2);
    assert.deepEqual(projectServices.map(service => service.projectConfig.configPath), [
      path.join(root, 'core/tsconfig.json'), path.join(root, 'infrastructure/tsconfig.json'),
    ]);
    const sibling = projectServices[1]!;
    assert.ok(sibling.program.getSourceFile(adapterPath));
    assert.ok(sibling.program.getSourceFile(path.join(root, 'core/src/ports.ts')));
    assert.equal(first.getNavigableSource(adapterPath), sibling.program.getSourceFile(adapterPath));
    assert.equal(second.getNavigableSource(adapterPath), first.getNavigableSource(adapterPath));
    const reads = readDirectory.mock.callCount();
    assert.equal([...registry.getProjectServices()][1], sibling);
    assert.equal(readDirectory.mock.callCount(), reads);
  });

  it('shares selected and discovered services and isolates workspaces', (t) => {
    const sibling = [...registry.getProjectServices()][1]!;
    const selectedSibling = registry.getService(sibling.projectConfig.configPath);
    assert.equal(selectedSibling, sibling);
    const siblingServices = [...registry.getProjectServices()];
    assert.equal(siblingServices[1], selectedSibling);
    assert.equal(siblingServices[0], selected);
    assert.equal([...registry.getProjectServices()][0], selected);
    assert.equal([...registry.getProjectServices()][1], sibling);

    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-registry-other-'));
    t.after(() => fs.rmSync(otherRoot, { recursive: true, force: true }));
    fs.cpSync(path.resolve('src/fixtures/workspace'), otherRoot, { recursive: true });
    fs.mkdirSync(path.join(otherRoot, '.git'));
    const otherRegistry = new LegacyProjectServiceRegistry(otherRoot);
    t.after(() => otherRegistry.clear());
    assert.throws(() => registry.getService(path.join(otherRoot, 'core/tsconfig.json')), /outside repository/);
    const other = otherRegistry.getService(path.join(otherRoot, 'core/tsconfig.json'));
    assert.equal(new ImplementationDiscovery(other.projectConfig.configPath, otherRegistry).getNavigableSource(adapterPath), undefined);
    const otherServices = [...otherRegistry.getProjectServices()];
    assert.equal(otherServices.length, 2);
    assert.ok(otherServices.every(service => service.projectConfig.configPath.startsWith(otherRoot + path.sep)));
    assert.notEqual(otherServices[1], sibling);
  });

  it('includes explicitly selected custom configs after workspace discovery', () => {
    assert.equal([...registry.getProjectServices()].length, 2);
    const configPath = path.join(root, 'custom/project.json');
    fs.mkdirSync(path.dirname(configPath));
    fs.writeFileSync(configPath, JSON.stringify({ files: ['index.ts'] }));
    fs.writeFileSync(path.join(root, 'custom/index.ts'), 'export const value = 1;');
    const custom = registry.getService(configPath);
    assert.equal(registry.getService(path.relative(process.cwd(), configPath)), custom);
    assert.ok([...registry.getProjectServices()].includes(custom));
    assert.equal([...registry.getProjectServices()].length, 3);
  });

  it('clears discovered workspaces and disposes all services', (t) => {
    const sibling = [...registry.getProjectServices()][1]!;
    const ownedDispose = t.mock.method(sibling.languageService, 'dispose');
    const selectedDispose = t.mock.method(selected.languageService, 'dispose');
    const extraDirectory = path.join(root, 'extra');
    fs.mkdirSync(extraDirectory);
    fs.writeFileSync(path.join(extraDirectory, 'tsconfig.json'), JSON.stringify({ files: ['index.ts'] }));
    fs.writeFileSync(path.join(extraDirectory, 'index.ts'), 'export const value = 1;');
    assert.equal([...registry.getProjectServices()].length, 2);
    registry.clear();
    registry.clear();
    assert.equal(ownedDispose.mock.callCount(), 1);
    assert.equal(selectedDispose.mock.callCount(), 1);
    const refreshed = [...registry.getProjectServices()];
    assert.equal(refreshed.length, 3);
    assert.ok(refreshed.every(service => service !== sibling && service !== selected));
    assert.ok(refreshed.some(service => service.program.getSourceFile(path.join(extraDirectory, 'index.ts'))));
  });

  it('throws with the original cause on failed service creation and retries without clearing', (t) => {
    const originalReadFile = ts.sys.readFile;
    let failures = 0;
    const cause = new Error('fixture read failure');
    const readFile = t.mock.method(ts.sys, 'readFile', (fileName: string, encoding?: string) => {
      if (fileName === adapterPath) {
        failures++;
        throw cause;
      }
      return originalReadFile(fileName, encoding);
    });
    assert.throws(
      () => [...registry.getProjectServices()],
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, `FlowLens: failed to create project service for ${path.join(root, 'infrastructure/tsconfig.json')}`);
        assert.equal(error.cause, cause);
        return true;
      },
    );
    assert.equal(failures, 1);
    readFile.mock.restore();
    const services = [...registry.getProjectServices()];
    assert.equal(services.length, 2);
    assert.equal(services[0], selected);
    assert.ok(services[1]!.program.getSourceFile(adapterPath));
  });
});
