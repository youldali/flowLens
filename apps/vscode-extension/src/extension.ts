import * as path from "node:path";
import * as vscode from "vscode";

import { GraphBuilder } from "@flowlens/analyzer-core";
import { findNearestTsconfig } from "@flowlens/common";

import { FlowLensGraphWebview } from "./webview.js";

const supportedLanguageIds = new Set(["typescript", "typescriptreact"]);

export function activate(context: vscode.ExtensionContext): void {
  const graphWebview = new FlowLensGraphWebview(context.extensionUri);
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

    try {
      const tsconfigPathResult = findNearestTsconfig(path.dirname(filePath));

      if (tsconfigPathResult.isErr()) {
        const message = `FlowLens: Could not find tsconfig.json at or above ${path.dirname(filePath)}.`;
        console.error(message, payload);
        vscode.window.showErrorMessage(message);
        return;
      }

      const graphBuilder = new GraphBuilder(tsconfigPathResult.value);
      const buildResult = graphBuilder.fromFilePosition(filePath, offset);

      if (buildResult.isErr()) {
        const message = `FlowLens: Could not generate graph (${buildResult.error.reason}).`;
        console.error(message, payload);
        vscode.window.showErrorMessage(message);
        return;
      }

      const graph = graphBuilder.toJSON();

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
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
