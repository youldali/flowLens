#!/usr/bin/env node
import * as path from 'node:path';

import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
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
  const workspaceAnalysisService = new WorkspaceAnalysisService();

  try {
    const analyze = async () => {
      const result = await workspaceAnalysisService.analyze(entryFilePath);
      if (result.isErr()) throw new Error(`Could not build graph: ${result.error.reason}`);
      return result.value;
    };
    // Validate the entry before starting the viewer; subsequent requests analyze current disk state.
    console.log(await analyze());
    await serveGraphViewer(analyze, () => workspaceAnalysisService.dispose());
  } catch (error) {
    try {
      await workspaceAnalysisService.dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Graph viewer startup and workspace cleanup failed');
    }

    throw error;
  }
}
