#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';

import { GraphBuilder } from '@flowlens/analyzer-core';

const args = process.argv.slice(2);

if (args[0] === '--') {
  args.shift();
}

if (args.length !== 1) {
  console.error('Usage: flow-graph <entry-file>');
  process.exitCode = 1;
} else {
  const entryFile = args[0]!;
  const invocationDir = process.env.INIT_CWD ?? process.cwd();
  const entryFilePath = path.resolve(invocationDir, entryFile);
  const tsconfigPath = findNearestTsconfig(path.dirname(entryFilePath));
  const graphBuilder = new GraphBuilder(tsconfigPath);

  graphBuilder.build(entryFilePath);
  console.log(graphBuilder.extract());
}

function findNearestTsconfig(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(currentDir, 'tsconfig.json');

    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error(`Could not find tsconfig.json at or above ${startDir}`);
    }

    currentDir = parentDir;
  }
}
