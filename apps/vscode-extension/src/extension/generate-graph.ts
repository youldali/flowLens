import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph';
import type { AnalysisError, WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';

type GenerateGraphOptions = {
  filePath: string;
  offset: number;
  analysisService: WorkspaceAnalysisService;
  onSuccess: (graph: FlowGraph) => void | Promise<void>;
  onFailure: (error: AnalysisError) => void | Promise<void>;
};

export async function generateGraph({
  filePath, offset, analysisService, onSuccess, onFailure,
}: GenerateGraphOptions): Promise<void> {
  const graphResult = await analysisService.analyze(filePath, offset);
  await graphResult.match(onSuccess, onFailure);
}
