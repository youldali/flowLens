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
export const window = {
  createWebviewPanel: () => {
    const panel = new MockPanel();
    panels.push(panel);
    return panel;
  },
};
export const Uri = { file: (fsPath: string) => ({ fsPath }) };
export const ViewColumn = { Beside: 2 };
