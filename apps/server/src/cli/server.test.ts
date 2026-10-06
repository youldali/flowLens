import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { describe, it } from 'node:test';
import { GraphAdapter } from '@flowlens/analyzer-core/graph-adapter';
import { assertOk } from '@flowlens/common/testing';
import { createGraphViewerServer } from './server.js';

describe('createGraphViewerServer', () => {
  it('serves an implementation from a dependent workspace project', async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-server-workspace-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.cpSync(path.resolve('../../packages/analyzer-core/src/fixtures/workspace'), root, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    const adapter = new GraphAdapter(path.join(root, 'core/tsconfig.json'));
    assertOk(adapter.fromFile(path.join(root, 'core/src/use-case.ts')));
    const app = createGraphViewerServer(adapter, path.resolve('../frontend/dist'));
    t.after(() => app.close());
    const graphResponse = await app.inject({ method: 'GET', url: '/graph.json' });
    assert.equal(graphResponse.statusCode, 200);
    const graph = graphResponse.json();
    const member = graph.nodes.find((node: { implementations?: unknown[] }) => node.implementations?.length);
    const [entry] = member.implementations;
    assert.equal(entry.filePath, path.join(root, 'infrastructure/src/adapter.ts'));
    const response = await app.inject({
      method: 'GET',
      url: '/source?filePath=' + encodeURIComponent(entry.filePath) + '&offset=' + entry.offset,
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /PlainCustomerRepositoryAdapter/);
    assert.match(response.body, /id="selected" class="selected"/);
  });

  it('serves eager graph metadata and navigable project source while rejecting unknown files', async () => {
    const adapter = new GraphAdapter(path.resolve('../../packages/analyzer-core/tsconfig.json'));
    const filePath = path.resolve('../../packages/analyzer-core/src/fixtures/implementation-entry.ts');
    assertOk(adapter.fromFile(filePath));
    const member = adapter.extract().nodes.find((node) =>
      node.kind === 'callableTypeMemberDeclaration' && node.name === 'run');
    assert.ok(member);
    const app = createGraphViewerServer(adapter, path.resolve('../frontend/dist'));

    try {
      const graphResponse = await app.inject({ method: 'GET', url: '/graph.json' });
      assert.equal(graphResponse.statusCode, 200);
      const graph = graphResponse.json();
      const graphMember = graph.nodes.find((node: { id: string }) => node.id === member.id);
      const [entry] = graphMember.implementations;
      assert.equal(entry.name, 'run');

      const source = await app.inject({
        method: 'GET',
        url: '/source?filePath=' + encodeURIComponent(entry.filePath) + '&offset=' + entry.offset,
      });
      assert.equal(source.statusCode, 200);
      assert.match(source.body, /class ClassRunner/);
      assert.match(source.body, /id="selected" class="selected"/);

      const missing = await app.inject({
        method: 'GET',
        url: '/source?filePath=' + encodeURIComponent('/etc/passwd') + '&offset=0',
      });
      assert.equal(missing.statusCode, 404);
      assert.deepEqual(missing.json(), { reason: 'source-not-found' });

      const invalidQueryUrls = [
        '/source',
        '/source?filePath=' + encodeURIComponent(entry.filePath),
        '/source?filePath=' + encodeURIComponent(entry.filePath) + '&offset=',
        '/source?filePath=' + encodeURIComponent(entry.filePath) + '&offset=-1',
        '/source?filePath=' + encodeURIComponent(entry.filePath) + '&offset=1.5',
      ];

      for (const url of invalidQueryUrls) {
        const invalid = await app.inject({ method: 'GET', url });
        assert.equal(invalid.statusCode, 400, url);
        const body = invalid.json();
        assert.equal(body.reason, 'invalid-request');
        assert.ok(Array.isArray(body.error));
        assert.ok(body.error.length > 0);
      }

      const outOfRange = await app.inject({
        method: 'GET',
        url: '/source?filePath=' + encodeURIComponent(entry.filePath) + '&offset=' + Number.MAX_SAFE_INTEGER,
      });
      assert.equal(outOfRange.statusCode, 400);
      assert.deepEqual(outOfRange.json(), {
        reason: 'invalid-offset',
        error: 'the offset is out of the file bounds',
      });
    } finally {
      await app.close();
    }
  });
});
