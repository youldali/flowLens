export class MockQuickPick<T extends import('vscode').QuickPickItem> {
  title?: string;
  placeholder?: string;
  ignoreFocusOut = false;
  items: readonly T[] = [];
  activeItems: readonly T[] = [];
  selectedItems: readonly T[] = [];
  disposed = false;
  private accept = () => {};
  private hide = () => {};
  onDidAccept(handler: () => void) {
    this.accept = handler;
    return { dispose: () => { this.accept = () => {}; } };
  }
  onDidHide(handler: () => void) {
    this.hide = handler;
    return { dispose: () => { this.hide = () => {}; } };
  }
  show() { this.hide(); }
  acceptSelection(item: T) { this.selectedItems = [item]; this.accept(); }
  cancel() { this.hide(); }
  dispose() { this.disposed = true; }
}

export class MockPanel {
  readonly messages: unknown[] = [];
  private onDispose = () => {};
  private onMessage: (message: unknown) => unknown = () => {};
  readonly webview = {
    html: '',
    cspSource: 'mock-webview',
    asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => uri.fsPath }),
    postMessage: async (message: unknown) => { this.messages.push(message); return true; },
    onDidReceiveMessage: (handler: (message: unknown) => unknown) => { this.onMessage = handler; },
  };

  onDidDispose(handler: () => void) { this.onDispose = handler; }
  dispose() { this.onDispose(); }
  reveal() {}
  async receive(message: unknown) { await this.onMessage(message); }
}

export const panels: MockPanel[] = [];
export const commands = {
  executeCommand: async (_id: string): Promise<unknown> => undefined,
  registerCommand: (_id: string, _handler: (...args: unknown[]) => unknown) => ({ dispose() {} }),
};
export const window = {
  createQuickPick: <T extends import('vscode').QuickPickItem>() => new MockQuickPick<T>(),
  showInputBox: async (_options: import('vscode').InputBoxOptions): Promise<string | undefined> => undefined,
  showInformationMessage: async (_message: string): Promise<string | undefined> => undefined,
  showErrorMessage: async (_message: string): Promise<string | undefined> => undefined,
  showWarningMessage: async (_message: string, _options: import('vscode').MessageOptions, ..._items: string[]): Promise<string | undefined> => undefined,
  createWebviewPanel: () => {
    const panel = new MockPanel();
    panels.push(panel);
    return panel;
  },
};
export const Uri = { file: (fsPath: string) => ({ fsPath }) };
export const ViewColumn = { Beside: 2 };

export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
export const workspace = {
  getConfiguration: (_section: string) => ({
    get: (_key: string, defaultValue: unknown): unknown => defaultValue,
    update: async (_key: string, _value: unknown, _target: number): Promise<void> => {},
  }),
};
