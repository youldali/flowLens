#!/usr/bin/env node
import * as path from 'node:path';

import { GraphBuilder } from './flow-graph.js';

const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error('Usage: flow-graph <entry-file>');
  process.exitCode = 1;
} else {
  const entryFile = args[0]!;
  const graphBuilder = new GraphBuilder('tsconfig.json');

  graphBuilder.build(path.resolve(entryFile));
  console.log(graphBuilder.extract());
}
