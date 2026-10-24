import * as path from "node:path";
import * as vscode from "vscode";

import { FlowLensGraphWebview } from "@infrastructure/webview.js";
import { getAIProvider } from '@infrastructure/configuration.js';
import { registerAIKeyCommands } from '@infrastructure/ai-key-commands.js';
import { createExplainFunction } from '@infrastructure/explain-function.js';
import { createAIKeyStorage } from '@infrastructure/ai-key-storage.js';
import { AiKeyService } from '@services/ai-key-service.js';
import { RepositoryAnalysisService } from '@services/repository-analysis-service.js';

let repositoryAnalysisService: RepositoryAnalysisService | undefined;

const supportedLanguageIds = new Set(["typescript", "typescriptreact"]);

export function activate(context: vscode.ExtensionContext): void {
  if (repositoryAnalysisService) throw new Error('FlowLens is already active or shutting down');

  const activeRepositoryAnalysisService = new RepositoryAnalysisService();
  repositoryAnalysisService = activeRepositoryAnalysisService;
  const keyStorage = createAIKeyStorage(context.secrets);
  const aiKeyService = new AiKeyService(keyStorage);
  const explainFunction = createExplainFunction(provider => aiKeyService.getAiApiKey(provider), getAIProvider);
  context.subscriptions.push(...registerAIKeyCommands(aiKeyService));
  const graphWebview = new FlowLensGraphWebview(context.extensionUri, { explainFunction });
  const disposable = vscode.commands.registerCommand("flowlens.generateGraph", async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage("FlowLens: Open a TypeScript editor before generating a graph.");
      return;
    }

    const { document, selection } = editor;

    if (document.uri.scheme !== "file") {
      vscode.window.showWarningMessage("FlowLens: Generate Graph only supports files on disk.");
      return;
    }

    if (!supportedLanguageIds.has(document.languageId)) {
      vscode.window.showWarningMessage("FlowLens: Generate Graph only supports TypeScript files.");
      return;
    }

    const position = selection.active;
    const offset = document.offsetAt(position);
    const filePath = document.uri.fsPath;
    const payload = { filePath, offset };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "FlowLens: Preparing graph...",
        cancellable: false,
      },
      async () => {
        try {
          const graphResult = await activeRepositoryAnalysisService.analyze(filePath, offset);

          if (graphResult.isErr()) {
            const message = graphResult.error.reason === 'tsconfig-not-found'
              ? `FlowLens: Could not find tsconfig.json at or above ${path.dirname(filePath)}.`
              : `FlowLens: Could not generate graph (${graphResult.error.reason}).`;
            console.error(message, payload);
            vscode.window.showErrorMessage(message);
            return;
          }

          const graph = graphResult.value;

          console.log("FlowLens generated graph", { ...payload, graph });
          await graphWebview.showGraph(graph);
          vscode.window.showInformationMessage(
            `FlowLens: Generated graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
          );
        } catch (error) {
          const message = `FlowLens: ${getErrorMessage(error)}`;
          console.error(message, payload, error);
          vscode.window.showErrorMessage(message);
        }
      },
    );
  });

  context.subscriptions.push(disposable);
}

export async function deactivate(): Promise<void> {
  const activeRepositoryAnalysisService = repositoryAnalysisService;
  await activeRepositoryAnalysisService?.dispose();

  if (repositoryAnalysisService === activeRepositoryAnalysisService) {
    repositoryAnalysisService = undefined;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
