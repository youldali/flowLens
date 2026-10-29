import * as path from 'node:path';
import * as vscode from 'vscode';
import { findNearestTsconfig, findWorkspaceRoot, isWithinDirectory } from '@flowlens/common/fs';
import type { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
import type { FlowLensGraphWebview } from '@infrastructure/webview.js';
import type { ExtensionStore } from '../state.js';
import { generateGraph } from '../generate-graph.js';

type RegisterGenerateGraphCommandOptions = {
  analysisService: WorkspaceAnalysisService;
  graphWebview: FlowLensGraphWebview;
  store: ExtensionStore;
  isExtensionActive: () => boolean;
};

const supportedLanguageIds = new Set(['typescript', 'typescriptreact']);

export function registerGenerateGraphCommand({
  analysisService, graphWebview, store, isExtensionActive,
}: RegisterGenerateGraphCommandOptions): vscode.Disposable {
  let latestRequest = 0;

  return vscode.commands.registerCommand("flowlens.generateGraph", async () => {
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
    const filePath = document.uri.fsPath;
    const payload = { filePath };
    const request = ++latestRequest;
    const revision = store.getState().documentRevision;
    const isRequestCurrent = () => isExtensionActive() && request === latestRequest;
    const hasSourceChanged = () => revision !== store.getState().documentRevision;
    const canPresentResult = () => {
      if (!isRequestCurrent()) return false;
      if (!hasSourceChanged()) return true;

      vscode.window.showInformationMessage('FlowLens: Source changed during analysis. Generate the graph again.');
      return false;
    };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "FlowLens: Preparing graph...",
        cancellable: false,
      },
      async () => {
        try {
          const config = findNearestTsconfig(path.dirname(filePath));
          const workspaceRoot = config.match(findWorkspaceRoot, () => path.dirname(filePath));
          const hasUnsavedFiles = document.isDirty || vscode.workspace.textDocuments.some(openDocument =>
            openDocument.uri.scheme === 'file' && openDocument.isDirty && isWithinDirectory(workspaceRoot, openDocument.uri.fsPath));

          if (hasUnsavedFiles) {
            vscode.window.showWarningMessage('FlowLens: Save your changes in this workspace before generating a graph.');
            return;
          }

          await generateGraph({
            filePath,
            offset: document.offsetAt(position),
            analysisService,
            onSuccess: async graph => {
              if (!canPresentResult()) return;

              console.log('FlowLens generated graph', { ...payload, graph });
              await graphWebview.showGraph(graph);
              vscode.window.showInformationMessage(
                `FlowLens: Generated graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
              );
            },
            onFailure: error => {
              if (!canPresentResult()) return;

              const message = error.reason === 'tsconfig-not-found'
                ? `FlowLens: Could not find tsconfig.json at or above ${path.dirname(filePath)}.`
                : `FlowLens: Could not generate graph (${error.reason}).`;
              console.error(message, payload);
              vscode.window.showErrorMessage(message);
            },
          });
        } catch (error) {
          if (!isRequestCurrent()) return;
          const message = `FlowLens: ${getErrorMessage(error)}`;
          console.error(message, payload, error);
          vscode.window.showErrorMessage(message);
        }
      },
    );
  });

}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
