import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

import { GraphBuilder, type FlowGraph } from "@flowlens/analyzer-core";
import { findNearestTsconfig } from "@flowlens/common";

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

      const graph = graphBuilder.extract();

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

class FlowLensGraphWebview {
  private panel: vscode.WebviewPanel | undefined;
  private pendingGraph: FlowGraph | undefined;
  private isReady = false;
  private readonly frontendDistUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.frontendDistUri = vscode.Uri.file(path.join(extensionUri.fsPath, "media", "frontend"));
  }

  async showGraph(graph: FlowGraph): Promise<void> {
    this.pendingGraph = graph;

    if (!this.panel) {
      await this.createPanel();
      return;
    }

    this.panel.reveal(vscode.ViewColumn.Beside);

    if (this.isReady) {
      await this.postPendingGraph();
    }
  }

  private async createPanel(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "flowlensGraph",
      "FlowLens Graph",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [this.frontendDistUri],
      },
    );

    this.panel = panel;
    this.isReady = false;

    panel.onDidDispose(() => {
      this.panel = undefined;
      this.isReady = false;
    });

    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isReadyMessage(message)) {
        return;
      }

      this.isReady = true;
      void this.postPendingGraph();
    });

    try {
      panel.webview.html = await this.getWebviewHtml(panel.webview);
    } catch (error) {
      panel.dispose();
      throw error;
    }
  }

  private async postPendingGraph(): Promise<void> {
    if (!this.panel || !this.pendingGraph) {
      return;
    }

    await this.panel.webview.postMessage({ graph: this.pendingGraph });
  }

  private async getWebviewHtml(webview: vscode.Webview): Promise<string> {
    const indexHtmlPath = vscode.Uri.file(path.join(this.frontendDistUri.fsPath, "index.html"));
    const indexHtml = await fs.readFile(indexHtmlPath.fsPath, "utf8");
    const nonce = getNonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join("; ");
    const runtimeScript = [
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      `<script nonce="${nonce}">`,
      "window.__vscodeApi = acquireVsCodeApi();",
      'window.__flowlensHost = "vscode";',
      "window.addEventListener('load', () => {",
      "  window.setTimeout(() => window.__vscodeApi.postMessage({ type: 'flowlens.ready' }), 0);",
      "});",
      "</script>",
    ].join("\n");
    const htmlWithWebviewUris = rewriteRootRelativeUris(indexHtml, webview, this.frontendDistUri);
    const htmlWithNonce = htmlWithWebviewUris.replaceAll("<script ", `<script nonce="${nonce}" `);

    return htmlWithNonce.includes("</head>")
      ? htmlWithNonce.replace("</head>", `${runtimeScript}\n  </head>`)
      : `${runtimeScript}\n${htmlWithNonce}`;
  }
}

function rewriteRootRelativeUris(
  html: string,
  webview: vscode.Webview,
  frontendDistUri: vscode.Uri,
): string {
  return html.replaceAll(/(href|src)="\/([^"]+)"/g, (_match, attribute: string, assetPath: string) => {
    const assetUri = vscode.Uri.file(path.join(frontendDistUri.fsPath, ...assetPath.split("/")));
    return `${attribute}="${webview.asWebviewUri(assetUri).toString()}"`;
  });
}

function isReadyMessage(message: unknown): message is { type: "flowlens.ready" } {
  return (
    typeof message === "object"
    && message !== null
    && "type" in message
    && message.type === "flowlens.ready"
  );
}

function getNonce(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  return Array.from({ length: 32 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join("");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
