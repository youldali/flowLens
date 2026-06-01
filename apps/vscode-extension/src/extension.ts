import * as vscode from "vscode";

const supportedLanguageIds = new Set(["typescript", "typescriptreact"]);

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("flowlens.generateGraph", () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage("FlowLens: Open a TypeScript editor before generating a graph.");
      return;
    }

    const { document, selection } = editor;

    if (!supportedLanguageIds.has(document.languageId)) {
      vscode.window.showWarningMessage("FlowLens: Generate Graph only supports TypeScript files.");
      return;
    }

    const position = selection.active;
    const offset = document.offsetAt(position);
    const filePath = document.uri.fsPath;
    const payload = { filePath, offset };

    console.log("FlowLens generateGraph payload", payload);
    vscode.window.showInformationMessage(`FlowLens: ${JSON.stringify(payload)}`);
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
