import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { assertErr, assertOk } from '@flowlens/common/testing';
import * as ts from '../fixtures/native-compiler.js';
import { GraphAdapter } from '../adapters/graph-adapter.js';
import { ImplementationDiscovery } from './implementation-discovery.js';
import { TypeScriptCompilationRegistry } from './typescript-compilation-registry.js';
import { isCallableTypeMemberDeclarationNode } from '../domain/node.js';

describe('ImplementationDiscovery', () => {
  let root: string;
  let compilationRegistry: TypeScriptCompilationRegistry;
  let configPath: string;
  let portsPath: string;
  let adapterPath: string;
  let plainPosition: number;
  let mappedPosition: number;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-workspace-'));
    fs.cpSync(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    configPath = path.join(root, 'core/tsconfig.json');
    portsPath = path.join(root, 'core/src/ports.ts');
    adapterPath = path.join(root, 'infrastructure/src/adapter.ts');
    const text = fs.readFileSync(portsPath, 'utf8');
    plainPosition = text.indexOf('list()');
    mappedPosition = text.indexOf('list()', text.indexOf('type Reads'));
    const compilationRegistryCreationResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(compilationRegistryCreationResult);
    compilationRegistry = compilationRegistryCreationResult.value;
  });

  afterEach(async () => {
    await compilationRegistry.clear();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('discovers sibling implementations without traversing their bodies', async t => {
    const adapterResult = await GraphAdapter.create(portsPath, compilationRegistry);
    assertOk(adapterResult);
    const adapter = adapterResult.value;
    assertOk(await adapter.fromFile(path.join(root, 'core/src/use-case.ts')));
    const graph = adapter.extract();
    const members = graph.nodes.filter(isCallableTypeMemberDeclarationNode);
    const entries = members.flatMap(member => member.implementations);
    assert.equal(entries.length, 1);
    const entry = entries[0]!;
    assert.equal(entry.filePath, adapterPath);
    assert.equal(entry.name, 'list');
    const text = fs.readFileSync(adapterPath, 'utf8');
    const offset = text.indexOf('list()', text.indexOf('class PlainCustomerRepositoryAdapter'));
    const coordinates = ts.createSourceFile(adapterPath, text, ts.ScriptTarget.Latest).getLineAndCharacterOfPosition(offset);
    assert.equal(entry.offset, offset);
    assert.equal(entry.line, coordinates.line + 1);
    assert.equal(entry.column, coordinates.character + 1);
    // Native LSP retains the mapped-type limitation of the legacy language service.
    assert.equal(members.filter(member => member.name === 'list' && member.implementations.length === 0).length, 1);
    assert.ok(graph.nodes.every(node => node.filePath.startsWith(path.join(root, 'core') + path.sep)));
    const baselineResult = await GraphAdapter.create(portsPath, compilationRegistry);
    assertOk(baselineResult);
    const baseline = baselineResult.value;
    const baselineDiscovery = (baseline as unknown as { implementationDiscovery: ImplementationDiscovery }).implementationDiscovery;
    t.mock.method(baselineDiscovery, 'findImplementations', async () => []);
    assertOk(await baseline.fromFile(path.join(root, 'core/src/use-case.ts')));
    assert.deepEqual(graph.edges, baseline.extract().edges);
    assert.deepEqual(graph.nodes.map(node => isCallableTypeMemberDeclarationNode(node) ? { ...node, implementations: [] } : node), baseline.extract().nodes);
    assertErr(await adapter.fromFile(adapterPath));
    const discovery = new ImplementationDiscovery(configPath, compilationRegistry);
    assert.deepEqual(await discovery.findImplementations(portsPath, mappedPosition), []);
  });

  it('finds multiple semantic candidates through aliases and re-exports, excluding unrelated same-named methods', async () => {
    const additionalPath = path.join(root, 'infrastructure/src/more implementations.ts');
    fs.writeFileSync(path.join(root, 'infrastructure/src/ports.ts'), "export { PlainCustomerRepository as Repository } from '@fixture/core/ports.js';\n");
    const text = [
      "import type { Repository as Port } from './ports.js';",
      "export class Second implements Port { /* 😀 */ list(): string[] { return []; } }",
      "export const object: Port = { list: () => [] };",
      "interface Other { list(): number; }",
      "export class Unrelated implements Other { list(): number { return 1; } }",
    ].join('\r\n');
    fs.writeFileSync(additionalPath, text);
    const customConfig = path.join(root, 'custom/project.json');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './custom/project.json' }] }));
    const customSource = path.join(root, 'custom/adapter.ts');
    fs.mkdirSync(path.dirname(customConfig));
    fs.writeFileSync(customConfig, JSON.stringify({
      files: ['adapter.ts'], references: [{ path: '../core' }],
      compilerOptions: { composite: true, module: 'NodeNext', strict: true, types: [] },
    }));
    fs.writeFileSync(customSource, "import type { PlainCustomerRepository as Port } from '../core/src/ports.js';\nexport class Custom implements Port { list(): string[] { return []; } }");
    await compilationRegistry.clear();
    const registryResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(registryResult);
    compilationRegistry = registryResult.value;
    const customResult = await compilationRegistry.getProject(customConfig);
    assertOk(customResult);
    const custom = customResult.value;
    assert.deepEqual(await custom.program.getSemanticDiagnostics(), []);
    const discovery = new ImplementationDiscovery(configPath, compilationRegistry);
    await compilationRegistry.getProject(configPath);
    const siblingResult = await compilationRegistry.getProject(path.join(root, 'infrastructure/tsconfig.json'));
    assertOk(siblingResult);
    const sibling = siblingResult.value;
    assert.deepEqual(await sibling.program.getSemanticDiagnostics(), []);
    const entries = await discovery.findImplementations(portsPath, plainPosition);
    const extra = entries.filter(entry => entry.filePath === additionalPath);
    assert.equal(entries.length, 4);
    assert.ok(entries.some(entry => entry.filePath === customSource));
    assert.deepEqual(extra.map(entry => entry.offset), [text.indexOf('list()'), text.indexOf('list:')]);
    assert.deepEqual(extra.map(entry => [entry.name, entry.line, entry.column]), [
      ['list', 2, text.split('\r\n')[1]!.indexOf('list') + 1],
      ['list', 3, text.split('\r\n')[2]!.indexOf('list') + 1],
    ]);
    const adapterResult = await GraphAdapter.create(portsPath, compilationRegistry);
    assertOk(adapterResult);
    const adapter = adapterResult.value;
    assertOk(await adapter.fromFile(path.join(root, 'core/src/use-case.ts')));
    assert.deepEqual(adapter.extract().nodes.filter(isCallableTypeMemberDeclarationNode).flatMap(node => node.implementations), entries);
    assert.ok(adapter.extract().nodes.every(node => node.filePath.startsWith(path.join(root, 'core') + path.sep)));
    assert.equal(fs.existsSync(path.join(root, 'core/dist')), false);
  });

  it('deduplicates results, filters non-navigable sources, and caches only successful queries', async t => {
    const outside = root + '-outside.ts';
    const excludedPaths = [path.join(root, 'core/src/excluded.d.ts'), path.join(root, 'node_modules/dependency/index.ts'), outside, path.join(root, 'missing.ts')];

    for (const filePath of excludedPaths.slice(0, -1)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'export function excluded(): void {}');
    }

    t.after(() => fs.rmSync(outside, { force: true }));
    await compilationRegistry.clear();
    const registryResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(registryResult);
    compilationRegistry = registryResult.value;
    const coreResult = await compilationRegistry.getProject(configPath);
    assertOk(coreResult);
    const core = coreResult.value;
    await compilationRegistry.getProjects();
    const source = await core.program.getSourceFile(portsPath);
    assert.ok(source);
    const coordinates = source.getLineAndCharacterOfPosition(plainPosition);
    const server = await compilationRegistry.getServer();
    const locations = await server.findImplementations(portsPath, coordinates.line, coordinates.character);
    assert.equal(locations.length, 1);
    const originalGetSourceFile = core.program.getSourceFile.bind(core.program);
    t.mock.method(core.program, 'getSourceFile', async (fileName: string) => excludedPaths.includes(fileName)
      ? ts.createSourceFile(fileName, 'export function excluded(): void {}', ts.ScriptTarget.Latest)
      : originalGetSourceFile(fileName));
    const failure = new Error('implementation request failed');
    const query = t.mock.method(server, 'findImplementations', async () => {
      if (query.mock.callCount() === 0) throw failure;
      return [...locations, ...locations, ...excludedPaths.map(filePath => ({
        uri: pathToFileURL(filePath).href,
        range: { start: { line: 0, character: 16 }, end: { line: 0, character: 24 } },
      }))];
    });
    const discovery = new ImplementationDiscovery(configPath, compilationRegistry);
    await assert.rejects(discovery.findImplementations(portsPath, plainPosition), error => error === failure);
    const entries = await discovery.findImplementations(portsPath, plainPosition);
    assert.deepEqual(entries.map(entry => entry.filePath), [adapterPath]);
    assert.equal(await discovery.findImplementations(portsPath, plainPosition), entries);
    assert.equal(query.mock.callCount(), 2);
  });
});
