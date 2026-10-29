import type * as vscode from 'vscode';

import { FlowLensGraphWebview } from "@infrastructure/webview.js";
import { getAIProvider } from '@infrastructure/configuration.js';
import { registerAIKeyCommands } from '@infrastructure/ai-key-commands.js';
import { createExplainFunction } from '@infrastructure/explain-function.js';
import { createAIKeyStorage } from '@infrastructure/ai-key-storage.js';
import { AiKeyService } from '@services/ai-key-service.js';
import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
import { createExtensionStore } from './state.js';
import { setupSubscriptions } from './subscription.js';
import { registerGenerateGraphCommand } from './commands/generate-graph.js';

let workspaceAnalysisService: WorkspaceAnalysisService | undefined;
let shuttingDown = false;

export function activate(context: vscode.ExtensionContext): void {
  if (workspaceAnalysisService) throw new Error('FlowLens is already active or shutting down');

  const activeWorkspaceAnalysisService = new WorkspaceAnalysisService();
  workspaceAnalysisService = activeWorkspaceAnalysisService;
  shuttingDown = false;
  const keyStorage = createAIKeyStorage(context.secrets);
  const aiKeyService = new AiKeyService(keyStorage);
  const explainFunction = createExplainFunction(provider => aiKeyService.getAiApiKey(provider), getAIProvider);
  context.subscriptions.push(...registerAIKeyCommands(aiKeyService));
  const graphWebview = new FlowLensGraphWebview(context.extensionUri, { explainFunction });
  const store = createExtensionStore();
  context.subscriptions.push(...setupSubscriptions(store));
  context.subscriptions.push(registerGenerateGraphCommand({
    analysisService: activeWorkspaceAnalysisService,
    graphWebview,
    store,
    isExtensionActive: () => !shuttingDown && workspaceAnalysisService === activeWorkspaceAnalysisService,
  }));
}

export async function deactivate(): Promise<void> {
  shuttingDown = true;
  const activeWorkspaceAnalysisService = workspaceAnalysisService;
  await activeWorkspaceAnalysisService?.dispose();

  if (workspaceAnalysisService === activeWorkspaceAnalysisService) {
    workspaceAnalysisService = undefined;
  }
}
