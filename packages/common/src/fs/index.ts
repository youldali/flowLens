import * as fs from 'node:fs';
import * as path from 'node:path';
import { err, ok, type Result } from 'neverthrow';

export function findNearestTsconfig(startDir: string): Result<string, "not-found"> {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(currentDir, 'tsconfig.json');

    if (fs.existsSync(candidate)) {
      return ok(candidate);
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return err("not-found");
    }

    currentDir = parentDir;
  }
}
