import { RepositoryAnalysisContext } from '@flowlens/analyzer-core/infrastructure/repository-analysis-context';
import * as path from 'node:path';
import { GraphAdapter, type FromFilePositionError } from '@flowlens/analyzer-core/adapter/graph-adapter';
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph';
import { findNearestTsconfig, findWorkspaceRoot } from '@flowlens/common/fs';
import { err, ok, type Result } from 'neverthrow';

type RepositoryRoot = string;
export type AnalysisError = FromFilePositionError | { reason: 'tsconfig-not-found' };

/** Reuses repository contexts and waits for their borrowers before shutdown. */
export class RepositoryAnalysisService {
  private readonly contexts = new Map<RepositoryRoot, RepositoryAnalysisContext>();
  private readonly activeAnalyses = new Set<Promise<Result<FlowGraph, AnalysisError>>>();
  private closing: Promise<void> | undefined;

  async analyze(filePath: string, offset: number): Promise<Result<FlowGraph, AnalysisError>> {
    if (this.closing) throw new Error('Repository analysis service is shutting down');
    const resolvedFilePath = path.resolve(filePath);
    const tsconfigPathResult = findNearestTsconfig(path.dirname(resolvedFilePath));

    if (tsconfigPathResult.isErr()) return err({ reason: 'tsconfig-not-found' });

    const repositoryRoot = findWorkspaceRoot(tsconfigPathResult.value);
    const repositoryAnalysisContext = this.contexts.get(repositoryRoot) ?? new RepositoryAnalysisContext(repositoryRoot);
    this.contexts.set(repositoryRoot, repositoryAnalysisContext);
    const analysisPromise = Promise.resolve().then(async () => {
      const graphAdapter = await GraphAdapter.create(tsconfigPathResult.value, repositoryAnalysisContext);
      const buildResult = await graphAdapter.fromFilePosition(resolvedFilePath, offset);

      return buildResult.isErr() ? err(buildResult.error) : ok(graphAdapter.extract());
    });
    this.activeAnalyses.add(analysisPromise);

    try {
      return await analysisPromise;
    } finally {
      this.activeAnalyses.delete(analysisPromise);
    }
  }

  dispose(): Promise<void> {
    this.closing ??= this.close();
    return this.closing;
  }

  private async close(): Promise<void> {
    // Analysis failures remain visible to their callers; all borrowers must finish.
    await Promise.allSettled([...this.activeAnalyses]);
    const contexts = [...this.contexts.values()];
    this.contexts.clear();
    const results = await Promise.allSettled(contexts.map(context => context.clear()));
    const failures = results.filter(result => result.status === 'rejected');

    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Failed to clear repository analysis contexts');
  }
}
