import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { describe, it } from 'node:test';
import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
import { GraphAdapter } from '@flowlens/analyzer-core/adapter/graph-adapter';
import { TypeScriptCompilationRegistry } from '@flowlens/analyzer-core/infrastructure/typescript-compilation-registry';
import { findWorkspaceRoot } from '@flowlens/common/fs';
import { assertOk } from '@flowlens/common/testing';
import { createGraphViewerServer } from './server.js';

describe('createGraphViewerServer', () => {
  it('generates a new graph ID per request while preserving graph contents', async (t) => {
    const config = path.resolve('../../packages/analyzer-core/tsconfig.json');
    const compilationRegistryCreationResult = await TypeScriptCompilationRegistry.create(findWorkspaceRoot(config));
    assertOk(compilationRegistryCreationResult);
    const compilationRegistry = compilationRegistryCreationResult.value;
    t.after(() => compilationRegistry.clear());
    const adapterResult = await GraphAdapter.create(path.resolve('../../packages/analyzer-core/src/fixtures/graph-builder-entry.ts'), compilationRegistry);
    assertOk(adapterResult);
    const adapter = adapterResult.value;
    const app = createGraphViewerServer(async () => adapter.extract(), path.resolve('../frontend/dist'), () => compilationRegistry.clear());
    t.after(() => app.close());
    const first = await app.inject({ method: 'GET', url: '/graph.json' });
    const second = await app.inject({ method: 'GET', url: '/graph.json' });
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const response of [first, second]) {
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.match(response.json().graphId, uuidPattern);
      assert.deepEqual(response.json().graph, adapter.extract());
    }

    assert.notEqual(first.json().graphId, second.json().graphId);
  });

  it('includes implementations from dependent workspace projects in graph metadata', async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-server-workspace-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.cpSync(path.resolve('../../packages/analyzer-core/src/fixtures/workspace'), root, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    const compilationRegistryCreationResult = await TypeScriptCompilationRegistry.create(root);
    assertOk(compilationRegistryCreationResult);
    const compilationRegistry = compilationRegistryCreationResult.value;
    t.after(() => compilationRegistry.clear());
    const adapterResult = await GraphAdapter.create(path.join(root, 'core/src/use-case.ts'), compilationRegistry);
    assertOk(adapterResult);
    const adapter = adapterResult.value;
    assertOk(await adapter.fromFile(path.join(root, 'core/src/use-case.ts')));
    const app = createGraphViewerServer(async () => adapter.extract(), path.resolve('../frontend/dist'), () => compilationRegistry.clear());
    t.after(() => app.close());
    const graphResponse = await app.inject({ method: 'GET', url: '/graph.json' });
    assert.equal(graphResponse.statusCode, 200);
    const { graph } = graphResponse.json();
    const member = graph.nodes.find((node: { implementations?: unknown[] }) => node.implementations?.length);
    const [entry] = member.implementations;
    assert.equal(entry.filePath, path.join(root, 'infrastructure/src/adapter.ts'));

  });

  it('serves eager implementation metadata', async (t) => {
    const config = path.resolve('../../packages/analyzer-core/tsconfig.json');
    const compilationRegistryCreationResult = await TypeScriptCompilationRegistry.create(findWorkspaceRoot(config));
    assertOk(compilationRegistryCreationResult);
    const compilationRegistry = compilationRegistryCreationResult.value;
    t.after(() => compilationRegistry.clear());
    const adapterResult = await GraphAdapter.create(path.resolve('../../packages/analyzer-core/src/fixtures/graph-builder-entry.ts'), compilationRegistry);
    assertOk(adapterResult);
    const adapter = adapterResult.value;
    const filePath = path.resolve('../../packages/analyzer-core/src/fixtures/implementation-entry.ts');
    assertOk(await adapter.fromFile(filePath));
    const member = adapter.extract().nodes.find((node) =>
      node.kind === 'callableTypeMemberDeclaration' && node.name === 'run');
    assert.ok(member);
    const app = createGraphViewerServer(async () => adapter.extract(), path.resolve('../frontend/dist'), () => compilationRegistry.clear());

    try {
      const graphResponse = await app.inject({ method: 'GET', url: '/graph.json' });
      assert.equal(graphResponse.statusCode, 200);
      const { graph } = graphResponse.json();
      const graphMember = graph.nodes.find((node: { id: string }) => node.id === member.id);
      const [entry] = graphMember.implementations;
      assert.equal(entry.name, 'run');

    } finally {
      await app.close();
    }
  });
  it('closing one viewer leaves another repository available', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-viewers-'));
    const compilationRegistries: TypeScriptCompilationRegistry[] = [];
    const apps: ReturnType<typeof createGraphViewerServer>[] = [];
    t.after(async () => {
      try {
        await Promise.all(apps.map(app => app.close()));
        await Promise.all(compilationRegistries.map(compilationRegistry => compilationRegistry.clear()));
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    for (const workspaceName of ['first', 'second']) {
      const workspaceRoot = path.join(directory, workspaceName);
      fs.cpSync(path.resolve('../../packages/analyzer-core/src/fixtures/workspace'), workspaceRoot, { recursive: true });
      fs.mkdirSync(path.join(workspaceRoot, '.git'));
      const compilationRegistryCreationResult = await TypeScriptCompilationRegistry.create(workspaceRoot);
      assertOk(compilationRegistryCreationResult);
      const compilationRegistry = compilationRegistryCreationResult.value;
      compilationRegistries.push(compilationRegistry);

      const adapterResult = await GraphAdapter.create(path.join(compilationRegistry.root, 'core/src/use-case.ts'), compilationRegistry);
      assertOk(adapterResult);
      const adapter = adapterResult.value;
      assertOk(await adapter.fromFile(path.join(compilationRegistry.root, 'core/src/use-case.ts')));
      apps.push(createGraphViewerServer(async () => adapter.extract(), path.resolve('../frontend/dist'), () => compilationRegistry.clear()));
    }

    await Promise.all(apps.map(app => app.ready()));
    const firstCompilationResult = await compilationRegistries[0]!.getProject(path.join(compilationRegistries[0]!.root, 'core/tsconfig.json'));
    assertOk(firstCompilationResult);
    const firstCompilation = firstCompilationResult.value;
    const secondCompilationResult = await compilationRegistries[1]!.getProject(path.join(compilationRegistries[1]!.root, 'core/tsconfig.json'));
    assertOk(secondCompilationResult);
    const secondCompilation = secondCompilationResult.value;
    await apps[0]!.close();
    await assert.rejects(firstCompilation.program.getSourceFile('unused.ts'), /Client is closed/);
    assert.ok(await secondCompilation.program.getSourceFile(path.join(secondCompilation.currentDirectory, 'src/ports.ts')));
    assert.equal((await apps[1]!.inject({ method: 'GET', url: '/graph.json' })).statusCode, 200);
  });

  it('refreshes graphs, removes source navigation, and closes its analysis service', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-server-refresh-'));
    fs.mkdirSync(path.join(root, '.git'));
    const config = path.join(root, 'tsconfig.json');
    const file = path.join(root, 'entry.ts');
    fs.writeFileSync(config, JSON.stringify({ files: ['entry.ts'] }));
    fs.writeFileSync(file, 'export function before() { return 1; }');
    const workspaceAnalysisService = new WorkspaceAnalysisService();
    const app = createGraphViewerServer(async () => {
      const result = await workspaceAnalysisService.analyze(file);
      assertOk(result);
      return result.value;
    }, root, () => workspaceAnalysisService.dispose());
    t.after(async () => { await app.close(); fs.rmSync(root, { recursive: true, force: true }); });
    const first = (await app.inject('/graph.json')).json();
    fs.writeFileSync(file, 'export function after() { return 2; }');
    const [secondResponse, thirdResponse] = await Promise.all([app.inject('/graph.json'), app.inject('/graph.json')]);
    const second = secondResponse.json();
    assert.notEqual(second.graphId, thirdResponse.json().graphId);
    assert.ok(second.graph.nodes.some((node: { name: string }) => node.name === 'after'));
    assert.notEqual(first.graphId, second.graphId);
    assert.ok(first.graph.nodes.some((node: { name: string }) => node.name === 'before'));
    const sourceResponse = await app.inject('/source?' + new URLSearchParams({ graphId: first.graphId, filePath: file, offset: '0' }));
    assert.equal(sourceResponse.statusCode, 404);
    await app.close();
    await assert.rejects(workspaceAnalysisService.analyze(file), /shutting down/);
  });
});
