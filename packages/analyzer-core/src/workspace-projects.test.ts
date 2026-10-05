import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { loadProjectConfig } from './project-config.js';
import { discoverWorkspaceProjects } from './workspace-projects.js';

describe('discoverWorkspaceProjects', () => {
  it('follows references, deduplicates configs, and skips outputs', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-configs-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (relative: string, content: string): void => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    write('core/index.ts', 'export const value = 1;');
    write('core/tsconfig.json', '{ "files": ["index.ts"], "compilerOptions": { "outDir": "../generated" } }');
    write('tsconfig.json', '{ "files": [], "references": [{ "path": "./core" }, { "path": "./dependent/project.json" }] }');
    write('dependent/index.ts', 'export const value = 2;');
    write('dependent/project.json', '{ "files": ["index.ts"], "references": [{ "path": "../core" }] }');
    for (const directory of ['node_modules/dependency', '.git', 'dist', 'build', 'generated']) {
      write(directory + '/tsconfig.json', '{ "files": [], "references": [] }');
    }
    const configs = discoverWorkspaceProjects(root);
    assert.deepEqual(configs.map((config) => path.relative(root, config.configPath)), ['core/tsconfig.json', 'dependent/project.json', 'tsconfig.json']);
  });


  it('throws with the config path and original error as the cause for malformed configs', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-configs-'));
    const configPath = path.join(root, 'tsconfig.json');

    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(configPath, '{');

    assert.throws(() => loadProjectConfig(configPath), (originalError: unknown) => {
      assert.ok(originalError instanceof Error);
      assert.throws(() => discoverWorkspaceProjects(root), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, `Failed to discover workspace project ${configPath}`);
        assert.ok(error.cause instanceof Error);
        assert.equal(error.cause.message, originalError.message);
        return true;
      });
      return true;
    });
  });
});
