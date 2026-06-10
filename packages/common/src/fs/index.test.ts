import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { findNearestTsconfig } from './index.js';
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
