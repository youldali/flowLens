import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import * as ts from 'typescript';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { GraphAdapter } from '../adapters/graph-adapter.js';
import { ImplementationDiscovery } from './implementation-discovery.js';
import { ProjectServiceRegistry } from './project-service-registry.js';
import { isCallableTypeMemberDeclarationNode } from '../domain/node.js';
import type { ProjectService } from './project-service.js';

// Copy source fixtures into an isolated Git workspace so unrelated FlowLens
// projects cannot accidentally make the adapter visible to these tests.
describe('ImplementationDiscovery', () => {
  let root: string;
  let core: ProjectService;
  let infrastructure: ProjectService;
  let portsPath: string;
  let adapterPath: string;
  let plainPosition: number;
  let mappedPosition: number;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-workspace-'));
    fs.cpSync(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    portsPath = path.join(root, 'core/src/ports.ts');
    adapterPath = path.join(root, 'infrastructure/src/adapter.ts');
    const text = fs.readFileSync(portsPath, 'utf8');
    plainPosition = text.indexOf('list()');
    mappedPosition = text.indexOf('list()', text.indexOf('type Reads'));
  });

  beforeEach(() => {
    core = ProjectServiceRegistry.getInstance().getService(path.join(root, 'core/tsconfig.json'));
    infrastructure = ProjectServiceRegistry.getInstance().getService(path.join(root, 'infrastructure/tsconfig.json'));
  });

  afterEach(() => ProjectServiceRegistry.getInstance().clear());

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('preserves separate configurations and exposes the visibility and mapped-type limitations', () => {
    assert.equal(core.program.getSourceFile(adapterPath), undefined);
    assert.ok(infrastructure.program.getSourceFile(adapterPath));
    assert.ok(infrastructure.program.getSourceFile(portsPath));
    assert.equal(core.program.getCompilerOptions().target, ts.ScriptTarget.ES2022);
    assert.equal(infrastructure.program.getCompilerOptions().target, ts.ScriptTarget.ES2023);
    assert.equal(core.program.getCompilerOptions().paths, undefined);
    assert.deepEqual(infrastructure.program.getCompilerOptions().paths, { '@fixture/core/*': ['../core/src/*'] });
    assert.deepEqual(core.program.getSemanticDiagnostics(), []);
    assert.deepEqual(infrastructure.program.getSemanticDiagnostics(), []);
    assert.deepEqual(core.languageService.getImplementationAtPosition(portsPath, plainPosition) ?? [], []);
    const locations = infrastructure.languageService.getImplementationAtPosition(portsPath, plainPosition) ?? [];
    assert.deepEqual(locations.map((location) => location.fileName), [adapterPath]);
    // Characterization of TypeScript's limitation, not a custom resolution target.
    assert.deepEqual(infrastructure.languageService.getImplementationAtPosition(portsPath, mappedPosition) ?? [], []);
  });

  it('discovers and navigates sibling implementations without traversing their bodies', (t) => {
    const adapter = new GraphAdapter(path.join(root, 'core/tsconfig.json'));
    assertOk(adapter.fromFile(path.join(root, 'core/src/use-case.ts')));
    const graph = adapter.extract();
    const members = graph.nodes.filter(isCallableTypeMemberDeclarationNode);
    const entries = members.flatMap((member) => member.implementations);
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
    assert.equal(members.filter((member) => member.name === 'list' && member.implementations.length === 0).length, 1);
    assert.ok(graph.nodes.every((node) => node.filePath.startsWith(path.join(root, 'core') + path.sep)));
    const baseline = new GraphAdapter(path.join(root, 'core/tsconfig.json'));
    const baselineDiscovery = (baseline as unknown as { implementationDiscovery: ImplementationDiscovery }).implementationDiscovery;
    t.mock.method(baselineDiscovery, 'findImplementations', () => []);
    assertOk(baseline.fromFile(path.join(root, 'core/src/use-case.ts')));
    assert.deepEqual(graph.edges, baseline.extract().edges);
    assert.deepEqual(graph.nodes.map((node) => isCallableTypeMemberDeclarationNode(node) ? { ...node, implementations: [] } : node), baseline.extract().nodes);
    const source = adapter.getNavigableSource(entry.filePath);
    assertOk(source);
    assert.equal(source.value, text);
    assertErr(adapter.getNavigableSource(path.join(root, 'missing.ts')));
    assertErr(adapter.fromFile(adapterPath));
  });

  it('deduplicates across projects and excludes declarations, dependencies, and outside sources', (t) => {
    const sibling = root + '-outside.ts';
    const excludedPaths = [path.join(root, 'core/src/excluded.d.ts'), path.join(root, 'node_modules/dependency/index.ts'), sibling];
    for (const filePath of excludedPaths) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'export function excluded(): void {}');
    }
    t.after(() => {
      for (const filePath of excludedPaths) fs.rmSync(filePath, { force: true });
    });
    const implementation = infrastructure.languageService.getImplementationAtPosition(portsPath, plainPosition)![0]!;
    const originalGetSourceFile = core.program.getSourceFile.bind(core.program);
    t.mock.method(core.program, 'getSourceFile', (fileName: string) => {
      if (fileName === adapterPath) return infrastructure.program.getSourceFile(fileName);
      return excludedPaths.includes(fileName)
        ? ts.createSourceFile(fileName, fs.readFileSync(fileName, 'utf8'), ts.ScriptTarget.Latest)
        : originalGetSourceFile(fileName);
    });
    t.mock.method(core.languageService, 'getImplementationAtPosition', () => [
      implementation, implementation,
      ...excludedPaths.map((fileName) => ({ ...implementation, fileName, textSpan: { start: 16, length: 8 } })),
    ]);
    const discovery = new ImplementationDiscovery(core.projectConfig.configPath);
    const entries = discovery.findImplementations(portsPath, plainPosition);
    assert.deepEqual(entries.map((entry) => entry.filePath), [adapterPath]);
    for (const filePath of excludedPaths) assert.equal(discovery.getNavigableSource(filePath), undefined);
  });
});
