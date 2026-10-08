import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { loadProjectConfig } from './project-config.js';

describe('loadProjectConfig', () => {
  it('allows no inputs while preserving other config errors', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-config-'));
    const configPath = path.join(root, 'tsconfig.json');

    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(configPath, JSON.stringify({ compilerOptions: { strict: true } }));

    assert.deepEqual(loadProjectConfig(configPath).parsed.fileNames, []);

    fs.writeFileSync(configPath, JSON.stringify({ extends: './missing.json' }));

    assert.throws(() => loadProjectConfig(configPath), /missing\.json/);
  });
});
