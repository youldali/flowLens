import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import { NativeLanguageServer } from './native-language-server.js';

describe('NativeLanguageServer', () => {
  it('finds sibling implementations and shares unsaved edits with the compiler API', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'flowlens-native-'));
    await cp(path.resolve('src/fixtures/workspace'), root, { recursive: true });
    await mkdir(path.join(root, '.git'));
    const server = await NativeLanguageServer.create(root);

    try {
      const files = ['core/src/ports.ts', 'core/src/use-case.ts', 'infrastructure/src/adapter.ts'];

      for (const file of files) {
        const filePath = path.join(root, file);
        await server.updateFile(filePath, await readFile(filePath, 'utf8'));
      }

      const ports = path.join(root, files[0]!);
      const adapter = path.join(root, files[2]!);
      const implementations = await server.findImplementations(ports, 1, 2);
      assert.deepEqual(implementations, [{
        uri: pathToFileURL(adapter).href,
        range: { start: { line: 13, character: 2 }, end: { line: 13, character: 6 } },
      }]);
      const before = await server.getSnapshot();

      try {
        const beforeProject = await before.getDefaultProjectForFile(adapter);
        assert.ok(beforeProject);
        const original = await beforeProject.program.getSourceFile(adapter);
        assert.ok(original);
        const updated = original.text + '\nexport class Second implements PlainCustomerRepository { list(): string[] { return []; } }\n';
        await server.updateFile(adapter, updated);
        const afterLocations = await server.findImplementations(ports, 1, 2);
        assert.equal(afterLocations.length, 2);
        assert.deepEqual(afterLocations[0], implementations[0]);
        const after = await server.getSnapshot();

        try {
          const afterProject = await after.getDefaultProjectForFile(adapter);
          assert.ok(afterProject);
          assert.equal((await afterProject.program.getSourceFile(adapter))?.text, updated);
          assert.equal((await beforeProject.program.getSourceFile(adapter))?.text, original.text);
        } finally {
          await after.dispose();
        }
      } finally {
        await before.dispose();
      }
    } finally {
      await server.dispose();
      await server.dispose();
      await rm(root, { recursive: true, force: true });
    }

    await assert.rejects(server.getSnapshot(), /disposed/);
  });
});
