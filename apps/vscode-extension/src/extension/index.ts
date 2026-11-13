import type * as vscode from 'vscode';

import { FlowLensGraphWebview } from "@infrastructure/webview.js";
import { createVsCodeAiBackendConfiguration } from '@infrastructure/configuration.js';
import { registerAIKeyCommands } from '@infrastructure/ai-key-commands.js';
import { createAIKeyStorage } from '@infrastructure/ai-key-storage.js';
import { AiSettingsController } from '@controllers/ai-settings-controller.js';
import { GraphController } from '@controllers/graph-controller.js';
import { createServices } from './services.js';
import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
import { createExtensionStore } from './state.js';
import { setupSubscriptions } from './subscription.js';
import { registerGenerateGraphCommand } from './commands/generate-graph/index.js';

let workspaceAnalysisService: WorkspaceAnalysisService | undefined;
let shuttingDown = false;

export function activate(context: vscode.ExtensionContext): void {
  if (workspaceAnalysisService) throw new Error('FlowLens is already active or shutting down');

  const activeWorkspaceAnalysisService = new WorkspaceAnalysisService();
  workspaceAnalysisService = activeWorkspaceAnalysisService;
  shuttingDown = false;
  const services = createServices({
    keyStorage: createAIKeyStorage(context.secrets),
    backendConfiguration: createVsCodeAiBackendConfiguration(),
  });
  context.subscriptions.push(...registerAIKeyCommands(services.aiConfiguration));
  const graphWebview = new FlowLensGraphWebview(context.extensionUri, {
    aiSettingsController: new AiSettingsController(services),
    createGraphController: graph => new GraphController(graph, services),
  });
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
