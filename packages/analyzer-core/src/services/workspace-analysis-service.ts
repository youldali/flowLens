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

  analyze(filePath: FilePath, offset?: number): ResultFlow<FlowGraph, AnalysisError> {
    const service = this;
    return ResultFlow.gen<FlowGraph, AnalysisError>(async function* () {
      if (service.closing) throw new Error('Workspace analysis service is shutting down');

      const resolvedFilePath = path.resolve(filePath);
      const workspaceRoot = findWorkspaceRoot(resolvedFilePath);
      const analysisPromise = Promise.resolve().then(() => service.createAnalysisFlow(workspaceRoot, resolvedFilePath, offset).run());
      service.activeAnalyses.add(analysisPromise);
      let analysisResult: Result<FlowGraph, AnalysisError>;

      try {
        analysisResult = await analysisPromise;
      } finally {
        service.activeAnalyses.delete(analysisPromise);
      }

      return yield* analysisResult;
    });
  }

  dispose(): Promise<void> {
    this.closing ??= this.close();
    return this.closing;
  }

  private createAnalysisFlow(
    workspaceRoot: FilePath,
    filePath: FilePath,
    offset?: number,
  ): ResultFlow<FlowGraph, AnalysisError> {
    return ResultFlow.gen<FlowGraph, AnalysisError>(async function* () {
      let compilationRegistry: TypeScriptCompilationRegistry | undefined;
      let analysisFailure: { error: unknown } | undefined;
      let analysisResult: Result<FlowGraph, AnalysisError>;

      try {
        // Materialize the result so generator short-circuiting cannot skip cleanup.
        analysisResult = await ResultFlow.gen<FlowGraph, AnalysisError>(async function* () {
          compilationRegistry = yield* TypeScriptCompilationRegistry.create(workspaceRoot);
          const graphAdapter = yield* GraphAdapter.create(filePath, compilationRegistry);
          return yield* graphAdapter.analyze(filePath, offset);
        }).run();

        if (analysisResult.isErr()) analysisFailure = { error: analysisResult.error };
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

      return yield* analysisResult;
    });
  }

  private async close(): Promise<void> {
    // Analysis failures remain visible to their callers; all borrowers must finish.
    await Promise.allSettled([...this.activeAnalyses]);
  }
}
