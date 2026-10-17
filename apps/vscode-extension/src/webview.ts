import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

import { findNodeInGraphById, type FlowGraph } from "@flowlens/analyzer-core/domain/flow-graph";
import { isFunctionDeclarationNode, type Node, type FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract';
import { err, ok, type Result } from 'neverthrow';
import {
  createVsCodeEvent,
  isOpenSourceEvent,
  isExplainNodeEvent,
  isViewReadyEvent,
  type ExplainNodeEvent,
} from "@flowlens/registries/vscode-events";

import type { GraphId, GraphSession } from '@flowlens/analyzer-core/domain/graph-session';
import { createGraphSession } from './graph-session.js';

type ExplainFunction = (node: FunctionDeclarationNode) => Promise<FunctionExplanation>;
type FlowLensGraphWebviewOptions = { explainFunction?: ExplainFunction };
type NodeRequest = { graphId: GraphId; nodeId: string };
type NodeResolutionError = 'graph-unavailable' | 'stale-graph' | 'node-not-found';
type ExplanationError = 'node-not-explainable' | 'missing-api-token' | 'generation-failed';

export class FlowLensGraphWebview {
  private panel: vscode.WebviewPanel | undefined;
  private currentGraph: GraphSession | undefined;
  private isReady = false;
  private readonly frontendDistUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri, private readonly options: FlowLensGraphWebviewOptions = {}) {
    this.frontendDistUri = vscode.Uri.file(path.join(extensionUri.fsPath, "media", "frontend"));
  }

  async showGraph(graph: FlowGraph): Promise<void> {
    this.currentGraph = createGraphSession(graph);

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
      if (isExplainNodeEvent(message)) {
        const nodeResult = this.resolveNode(message.payload);

        if (nodeResult.isErr()) {
          await panel.webview.postMessage(createVsCodeEvent('explain.node.error', {
            ...message.payload,
            reason: nodeResult.error,
          }));
          return;
        }

        await this.explainNode(nodeResult.value, message, panel);
        return;
      }

      if (isOpenSourceEvent(message)) {
        void this.openSource(message.payload.filePath, message.payload.offset);
        return;
      }

      if (isViewReadyEvent(message)) {
        this.isReady = true;
        void this.postCurrentGraph();
      }
    });

    try {
      panel.webview.html = await this.getWebviewHtml(panel.webview);
    } catch (error) {
      panel.dispose();
      throw error;
    }
  }

  private resolveNode({ graphId, nodeId }: NodeRequest): Result<Node, NodeResolutionError> {
    if (!this.currentGraph) return err('graph-unavailable');
    if (this.currentGraph.graphId !== graphId) return err('stale-graph');
    const node = findNodeInGraphById(this.currentGraph.graph, nodeId);

    return node ? ok(node) : err('node-not-found');
  }

  private async explainNode(node: Node, request: ExplainNodeEvent, panel: vscode.WebviewPanel): Promise<void> {
    let result: Result<FunctionExplanation, ExplanationError>;

    if (!isFunctionDeclarationNode(node)) {
      result = err('node-not-explainable');
    } else if (!this.options.explainFunction) {
      result = err('missing-api-token');
    } else {
      try {
        result = ok(await this.options.explainFunction(node));
      } catch {
        result = err('generation-failed');
      }
    }

    const response = result.match(
      explanation => createVsCodeEvent('explain.node.result', { ...request.payload, explanation }),
      reason => createVsCodeEvent('explain.node.error', { ...request.payload, reason }),
    );

    // An old panel's request can finish after it closes and a new panel opens.
    if (this.panel !== panel) return;
    await panel.webview.postMessage(response);
  }

  private async postCurrentGraph(): Promise<void> {
    if (!this.panel || !this.currentGraph) {
      return;
    }

    await this.panel.webview.postMessage(createVsCodeEvent("flowgraph", this.currentGraph));
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
