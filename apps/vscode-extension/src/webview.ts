import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

import type { FlowGraph } from "@flowlens/analyzer-core/flow-graph";
import { createVsCodeEvent, isViewReadyEvent } from "@flowlens/registries/vscode-events";

export class FlowLensGraphWebview {
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
      if (!isViewReadyEvent(message)) {
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

    await this.panel.webview.postMessage(createVsCodeEvent("flowgraph", { graph: this.pendingGraph }));
  }

  private async getWebviewHtml(webview: vscode.Webview): Promise<string> {
    const indexHtmlPath = vscode.Uri.file(path.join(this.frontendDistUri.fsPath, "index.html"));
    const indexHtml = await fs.readFile(indexHtmlPath.fsPath, "utf8");
    const nonce = getNonce();
    const csp = [
      "default-src 'none'",
      `connect-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join("; ");
    const assetBase = webview.asWebviewUri(this.frontendDistUri).toString();
    const runtimeScript = [
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      `<script nonce="${nonce}">`,
      "window.__vscodeApi = acquireVsCodeApi();",
      'window.__flowlensHost = "vscode";',
      `window.__flowlensAssetBase = ${JSON.stringify(assetBase)};`,
      "</script>",
    ].join("\n");
    const htmlWithWebviewUris = rewriteRootRelativeUris(indexHtml, webview, this.frontendDistUri);
    const htmlWithNonce = htmlWithWebviewUris.replaceAll("<script ", `<script nonce="${nonce}" `);

    return htmlWithNonce.includes("<head>")
      ? htmlWithNonce.replace("<head>", `<head>\n${runtimeScript}`)
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

function getNonce(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  return Array.from({ length: 32 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join("");
}
