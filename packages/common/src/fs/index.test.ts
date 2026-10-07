import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { findNearestTsconfig, findTsConfigPaths, findWorkspaceRoot, isWithinDirectory, isWithinWorkspace } from './index.js';
import { assertErr, assertOk } from '../testing/index.js';

describe("findNearestTsconfig", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("returns the nearest tsconfig.json at or above the start directory", () => {
    const tempDir = createTempDir();
    const parentDir = path.join(tempDir, "project");
    const childDir = path.join(parentDir, "src", "feature");
    const parentTsconfig = path.join(parentDir, "tsconfig.json");
    const rootTsconfig = path.join(tempDir, "tsconfig.json");

    fs.mkdirSync(childDir, { recursive: true });
    fs.writeFileSync(rootTsconfig, "{}", "utf8");
    fs.writeFileSync(parentTsconfig, "{}", "utf8");

    const result = findNearestTsconfig(childDir);

    assertOk(result);
    assert.equal(result.value, parentTsconfig);
  });

  it("returns not-found when no tsconfig.json exists at or above the start directory", () => {
    const tempDir = createTempDir();
    const startDir = path.join(tempDir, "project", "src");

    fs.mkdirSync(startDir, { recursive: true });

    const result = findNearestTsconfig(startDir);

    assertErr(result);
    assert.equal(result.error, "not-found");
  });

  function createTempDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flowlens-common-"));
    tempDirs.push(tempDir);
    return tempDir;
  }
});

describe('isWithinDirectory', () => {
  it('includes the directory and descendants but excludes parents and siblings', () => {
    const root = path.resolve('workspace');

    assert.equal(isWithinDirectory(root, root), true);
    assert.equal(isWithinDirectory(root, path.join(root, 'src/file.ts')), true);
    assert.equal(isWithinDirectory(root, path.join(root, '..')), false);
    assert.equal(isWithinDirectory(root, root + '-sibling/file.ts'), false);
    assert.equal(isWithinDirectory(root, path.join(root, '../other/file.ts')), false);
  });
});

describe('findWorkspaceRoot', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-roots-'));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  for (const [label, marker, contents] of [
    ['pnpm', 'pnpm-workspace.yaml', 'packages: ["packages/*"]'],
    ['workspaces array', 'package.json', JSON.stringify({ workspaces: ['packages/*'] })],
    ['workspaces object', 'package.json', JSON.stringify({ workspaces: { packages: ['packages/*'] } })],
  ] as const) {
    it(`detects sibling packages without Git using ${label}`, () => {
      fs.writeFileSync(path.join(root, marker), contents);

      for (const name of ['core', 'common']) {
        const project = path.join(root, 'packages', name);

        fs.mkdirSync(project, { recursive: true });
        fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name }));
        assert.equal(findWorkspaceRoot(path.join(project, 'tsconfig.json')), root);
      }
    });
  }

  it('prefers the nearest workspace declaration inside a Git repository', () => {
    const nested = path.join(root, 'nested');
    const project = path.join(nested, 'packages/core');
    const configPath = path.join(project, 'tsconfig.json');

    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: ["nested"]');
    fs.writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));
    assert.equal(findWorkspaceRoot(configPath), nested);
  });

  it('reports malformed package manifests with their path and cause', () => {
    const manifestPath = path.join(root, 'package.json');

    fs.writeFileSync(manifestPath, '{');
    assert.throws(() => findWorkspaceRoot(path.join(root, 'tsconfig.json')), (error: Error) => {
      assert.ok(error.message.includes(manifestPath));
      assert.ok(error.cause instanceof SyntaxError);
      return true;
    });
  });

  it('falls back to the config directory without workspace or Git markers', () => {
    const project = path.join(root, 'packages/core');

    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    assert.equal(findWorkspaceRoot(path.join(project, 'tsconfig.json')), project);
  });

  for (const markerType of ['directory', 'file']) {
    it(`stops at a Git ${markerType} before an enclosing workspace`, () => {
      const repository = path.join(root, 'nested');
      const project = path.join(repository, 'packages/core');
      const marker = path.join(repository, '.git');

      fs.mkdirSync(project, { recursive: true });
      fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: ["nested"]');
      if (markerType === 'directory') {
        fs.mkdirSync(marker);
      } else {
        fs.writeFileSync(marker, 'gitdir: /some/repository/.git/worktrees/test');
      }

      assert.equal(findWorkspaceRoot(path.join(project, 'tsconfig.json')), repository);
    });
  }
});

describe('findTsConfigPaths', () => {
  it('finds nested tsconfig variants and skips excluded directories and unrelated files', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-tsconfigs-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const expected = ['tsconfig.json', 'packages/core/tsconfig.build.json'];
    const excluded = ['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.turbo', '.yarn', '.pnpm', '.cache'];
    const files = [
      ...expected,
      'project.json',
      'tsconfig.json.bak',
      'tsconfig..json',
      ...excluded.map(directory => directory + '/tsconfig.json'),
    ];
    files.forEach(relative => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '{}');
    });
    fs.mkdirSync(path.join(root, 'empty/tsconfig.json'), { recursive: true });

    assert.deepEqual(findTsConfigPaths(root).sort(), expected.map(relative => path.join(root, relative)).sort());
  });
});

describe('isWithinWorkspace', () => {
  it('checks workspace boundaries and symlink targets, including a symlinked workspace', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-workspace-boundary-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(path.join(workspace, '.git'), { recursive: true });
    const source = path.join(workspace, 'source.ts');
    const outside = path.join(root, 'outside.ts');
    fs.writeFileSync(source, '');
    fs.writeFileSync(outside, '');
    const internalLink = path.join(workspace, 'internal.ts');
    const externalLink = path.join(workspace, 'external.ts');
    const workspaceLink = path.join(root, 'workspace-link');
    fs.symlinkSync(source, internalLink, 'file');
    fs.symlinkSync(outside, externalLink, 'file');
    fs.symlinkSync(workspace, workspaceLink, 'junction');
    const configPath = path.join(workspace, 'tsconfig.json');

    assert.equal(isWithinWorkspace(configPath, source), true);
    assert.equal(isWithinWorkspace(configPath, outside), false);
    assert.equal(isWithinWorkspace(configPath, internalLink), true);
    assert.equal(isWithinWorkspace(configPath, externalLink), false);
    assert.equal(isWithinWorkspace(path.join(workspaceLink, 'tsconfig.json'), path.join(workspaceLink, 'source.ts')), true);
  });

  it('propagates filesystem errors when realpath resolution fails', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-workspace-missing-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    assert.throws(
      () => isWithinWorkspace(path.join(root, 'tsconfig.json'), path.join(root, 'missing.ts')),
      { code: 'ENOENT' },
    );
  });
});
