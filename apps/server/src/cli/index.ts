#!/usr/bin/env node
import * as path from 'node:path';

import { GraphBuilder } from '@flowlens/analyzer-core/flow-graph';
import { findNearestTsconfig } from '@flowlens/common';
import { serveGraphViewer } from './server.js';

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
  const tsconfigPathResult = findNearestTsconfig(path.dirname(entryFilePath));

  if (tsconfigPathResult.isErr()) {
    throw new Error(`Could not find tsconfig.json at or above ${path.dirname(entryFilePath)}`);
  }

  const graphBuilder = new GraphBuilder(tsconfigPathResult.value);

  const buildResult = graphBuilder.fromFile(entryFilePath);

  if (buildResult.isErr()) {
    throw new Error(`Could not build graph: ${buildResult.error.reason}`);
  }

  const graph = graphBuilder.extract();
  console.log(graph);

  await serveGraphViewer(graph);
}
