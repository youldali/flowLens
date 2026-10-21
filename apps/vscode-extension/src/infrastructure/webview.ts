import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

import type { FlowGraph } from "@flowlens/analyzer-core/domain/flow-graph";
import {
  createVsCodeEvent,
  isOpenSourceEvent,
  isViewReadyEvent,
} from "@flowlens/registries/vscode-events";

import { GraphController, type GraphControllerOptions } from '@services/graph-controller.js';

type FlowLensGraphWebviewOptions = GraphControllerOptions;

export class FlowLensGraphWebview {
  private panel: vscode.WebviewPanel | undefined;
  private graphController: GraphController | undefined;
  private isReady = false;
  private readonly frontendDistUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri, private readonly options: FlowLensGraphWebviewOptions = {}) {
    this.frontendDistUri = vscode.Uri.file(path.join(extensionUri.fsPath, "media", "frontend"));
  }

  async showGraph(graph: FlowGraph): Promise<void> {
    this.graphController = new GraphController(graph, this.options);

    if (!this.panel) {
      await this.createPanel();
      return;
    }

    this.panel.reveal(vscode.ViewColumn.Beside);

    if (this.isReady) {
      await this.postCurrentGraph();
    }
  }

  private async createPanel(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "flowlensGraph",
      "FlowLens Graph",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.frontendDistUri],
      },
    );

    this.panel = panel;
    this.isReady = false;

    panel.onDidDispose(() => {
      if (this.panel !== panel) return;
      this.panel = undefined;
      this.isReady = false;
    });

    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (this.panel !== panel) return;
      if (isOpenSourceEvent(message)) {
        void this.openSource(message.payload.filePath, message.payload.offset);
        return;
      }

      if (isViewReadyEvent(message)) {
        this.isReady = true;
        void this.postCurrentGraph();
        return;
      }

      const response = await this.graphController?.handleEvent(message);

      // An old panel's request can finish after it closes and a new panel opens.
      if (this.panel !== panel || !response) return;
      await panel.webview.postMessage(response);
    });

    try {
      panel.webview.html = await this.getWebviewHtml(panel.webview);
    } catch (error) {
      panel.dispose();
      throw error;
    }
  }

  private async postCurrentGraph(): Promise<void> {
    if (!this.panel || !this.graphController) {
      return;
    }

    await this.panel.webview.postMessage(createVsCodeEvent("flowgraph", this.graphController.session));
  }

  private async openSource(filePath: string, offset: number): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      const position = document.positionAt(offset);
      const editor = await vscode.window.showTextDocument(document, {
        preview: true,
        selection: new vscode.Range(position, position),
      });

      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`FlowLens: Could not open source (${getErrorMessage(error)}).`);
    }
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
