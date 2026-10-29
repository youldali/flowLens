import * as vscode from 'vscode';
import type { ExtensionStore } from './state.js';

export function setupSubscriptions(store: ExtensionStore): vscode.Disposable[] {
  const incrementRevision = () => store.update(state => ({
    ...state,
    documentRevision: state.documentRevision + 1,
  }));

  return [
    vscode.workspace.onDidChangeTextDocument(incrementRevision),
    vscode.workspace.onDidCloseTextDocument(incrementRevision),
    vscode.workspace.onDidCreateFiles(incrementRevision),
    vscode.workspace.onDidDeleteFiles(incrementRevision),
    vscode.workspace.onDidRenameFiles(incrementRevision),
  ];
}
