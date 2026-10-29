import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import { NativeLanguageServer } from './native-language-server.js';

describe('NativeLanguageServer', () => {
  it('finds saved sibling implementations through the shared compiler snapshot and disposes once', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-'));
    await cp(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    await mkdir(path.join(root, '.git'));
    const server = await NativeLanguageServer.create(root);

    try {
      const config = path.join(root, 'infrastructure/tsconfig.json');
      const snapshot = await server.getSnapshot({
        openProjects: [path.join(root, 'core/tsconfig.json'), config], ensurePrograms: true,
      });

      try {
        const ports = path.join(root, 'core/src/ports.ts');
        const adapter = path.join(root, 'infrastructure/src/adapter.ts');
        const implementations = await server.findImplementations(ports, 1, 2);
        assert.deepEqual(implementations, [{
          uri: pathToFileURL(adapter).href,
          range: { start: { line: 13, character: 2 }, end: { line: 13, character: 6 } },
        }]);
        const project = snapshot.getConfiguredProject(config);
        assert.ok(project);
        assert.equal((await project.program.getSourceFile(adapter))?.text, await readFile(adapter, 'utf8'));
      } finally {
        await snapshot.dispose();
      }
    } finally {
      const disposal = server.dispose();
      assert.equal(server.dispose(), disposal);
      await disposal;
      await rm(root, { recursive: true, force: true });
    }

    await assert.rejects(server.getSnapshot(), /disposed/);
  });
});
