import type { FlowGraph } from '#domain/flow-graph';
import { TypeScriptCompilationRegistry, type RegistryClearedError, type CompilationError, type ProjectNotFoundError } from '#infrastructure/typescript-compilation-registry';
import * as path from 'node:path';
import { GraphAdapter, type FromFilePositionError } from '#adapters/graph-adapter';
import { findWorkspaceRoot, type FilePath } from '@flowlens/common/fs';
import type { Result } from 'neverthrow';
import { ResultFlow } from '@youldali/result-flow';

export type AnalysisError = FromFilePositionError | CompilationError | ProjectNotFoundError | RegistryClearedError | { reason: 'workspace-closing' };

/** Owns fresh compiler resources for each analysis and waits for cleanup before shutdown. */
export class WorkspaceAnalysisService {
  private readonly activeAnalyses = new Set<Promise<Result<FlowGraph, AnalysisError>>>();
  private closing: Promise<void> | undefined;

  analyze(filePath: FilePath, offset?: number): ResultFlow<FlowGraph, AnalysisError> {
    return ResultFlow.from(() => {
      const resolvedFilePath = path.resolve(filePath);
      const workspaceRoot = findWorkspaceRoot(resolvedFilePath);
      const analysisPromise = Promise.resolve().then(() => this.createAnalysisFlow(workspaceRoot, resolvedFilePath, offset).run());
      this.activeAnalyses.add(analysisPromise);

      return analysisPromise.finally(() => {
        this.activeAnalyses.delete(analysisPromise);
      });
    }).precondition(
      () => !this.closing,
      () => ({ reason: 'workspace-closing' } as const),
    );
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
    return TypeScriptCompilationRegistry.create(workspaceRoot).chain(compilationRegistry =>
      ResultFlow.gen<FlowGraph, AnalysisError>(async function* () {
        const graphAdapter = yield* GraphAdapter.create(filePath, compilationRegistry);
        return yield* graphAdapter.analyze(filePath, offset);
      }).finally(async exit => {
        try {
          await compilationRegistry.clear();
        } catch (cleanupError) {
          if (exit.kind === 'ok') throw cleanupError;
          const analysisFailure = exit.kind === 'err' ? exit.error : exit.cause;
          throw new AggregateError([analysisFailure, cleanupError], 'Analysis and compiler cleanup failed');
        }
      }));
  }

  private async close(): Promise<void> {
    // Analysis failures remain visible to their callers; all borrowers must finish.
    await Promise.allSettled([...this.activeAnalyses]);
  }
}
