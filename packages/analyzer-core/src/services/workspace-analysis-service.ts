import type { FlowGraph } from '#domain/flow-graph';
import { TypeScriptCompilationRegistry, type CompilationError, type ProjectNotFoundError } from '#infrastructure/typescript-compilation-registry';
import * as path from 'node:path';
import { GraphAdapter, type FromFilePositionError } from '#adapters/graph-adapter';
import { findWorkspaceRoot, type FilePath } from '@flowlens/common/fs';
import type { Result } from 'neverthrow';
import { ResultFlow } from '@youldali/result-flow';

export type AnalysisError = FromFilePositionError | CompilationError | ProjectNotFoundError;

/** Owns fresh compiler resources for each analysis and waits for cleanup before shutdown. */
export class WorkspaceAnalysisService {
  private readonly activeAnalyses = new Set<Promise<Result<FlowGraph, AnalysisError>>>();
  private closing: Promise<void> | undefined;

  async analyze(filePath: FilePath, offset?: number): Promise<Result<FlowGraph, AnalysisError>> {
    if (this.closing) throw new Error('Workspace analysis service is shutting down');

    const resolvedFilePath = path.resolve(filePath);
    const workspaceRoot = findWorkspaceRoot(resolvedFilePath);
    const analysisPromise = this.createAnalysisPromise(workspaceRoot, resolvedFilePath, offset);
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

  private createAnalysisPromise(
    workspaceRoot: FilePath,
    filePath: FilePath,
    offset?: number,
  ): Promise<Result<FlowGraph, AnalysisError>> {
    return Promise.resolve().then(async () => {
      let compilationRegistry: TypeScriptCompilationRegistry | undefined;
      let analysisFailure: { error: unknown } | undefined;

      try {
        const analysisResult = await ResultFlow.gen<FlowGraph, AnalysisError>(async function* () {
          compilationRegistry = yield* await TypeScriptCompilationRegistry.create(workspaceRoot);
          const graphAdapter = yield* await GraphAdapter.create(filePath, compilationRegistry);
          return yield* await graphAdapter.analyze(filePath, offset);
        }).run();

        if (analysisResult.isErr()) analysisFailure = { error: analysisResult.error };
        return analysisResult;
      } catch (error) {
        analysisFailure = { error };
        throw error;
      } finally {
        try {
          await compilationRegistry?.clear();
        } catch (cleanupError) {
          if (analysisFailure) throw new AggregateError([analysisFailure.error, cleanupError], 'Analysis and compiler cleanup failed');
          throw cleanupError;
        }
      }
    });
  }

  private async close(): Promise<void> {
    // Analysis failures remain visible to their callers; all borrowers must finish.
    await Promise.allSettled([...this.activeAnalyses]);
  }
}
