import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, describe, it } from 'node:test';
import type { TextDocument, TextEditor, Uri as VsCodeUri } from 'vscode';
import { ok } from 'neverthrow';
import { commands, Uri, window, workspace } from '@mocks/vscode.js';
import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
import { createExtensionStore } from '../state.js';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'vscode' ? new URL('../../mocks/vscode.ts', import.meta.url).href : specifier, context);
  },
});
const { registerGenerateGraphCommand } = await import('./generate-graph.js');
const { FlowLensGraphWebview } = await import('@infrastructure/webview.js');
hooks.deregister();

afterEach(() => {
  window.activeTextEditor = undefined;
  workspace.textDocuments = [];
});

describe('registerGenerateGraphCommand', () => {
  it('requires saved repository documents and ignores dirty files in other repositories', async t => {
    const document = {
      uri: { scheme: 'file', fsPath: '/project/entry.ts' }, languageId: 'typescript', isDirty: true,
      offsetAt: () => { throw new Error('Dirty source offsets must not be used for analysis'); },
    } as unknown as TextDocument;
    const warnings = t.mock.method(window, 'showWarningMessage');
    const analyze = t.mock.method(WorkspaceAnalysisService.prototype, 'analyze', async () => ok({ nodes: [], edges: [] }));
    t.mock.method(FlowLensGraphWebview.prototype, 'showGraph', async () => {});
    window.activeTextEditor = { document, selection: { active: {} } } as TextEditor;
    const registration = t.mock.method(commands, 'registerCommand');
    const store = createExtensionStore();
    let extensionActive = true;
    const disposable = registerGenerateGraphCommand({
      analysisService: new WorkspaceAnalysisService(),
      graphWebview: new FlowLensGraphWebview(Uri.file('/extension') as VsCodeUri),
      store,
      isExtensionActive: () => extensionActive,
    });
    t.after(() => disposable.dispose());
    const command = registration.mock.calls.find(call => call.arguments[0] === 'flowlens.generateGraph')!.arguments[1];
    await command();
    assert.equal(analyze.mock.callCount(), 0);
    assert.match(warnings.mock.calls[0]!.arguments[0], /Save your changes/);
    Object.assign(document, { isDirty: false, offsetAt: () => 17 });
    workspace.textDocuments = [{ uri: { scheme: 'file', fsPath: '/project/tsconfig.json' }, isDirty: true } as TextDocument];
    await command();
    assert.equal(analyze.mock.callCount(), 0);
    workspace.textDocuments = [{ uri: { scheme: 'file', fsPath: '/other-project/dependency.ts' }, isDirty: true } as TextDocument];
    await command();
    assert.equal(analyze.mock.callCount(), 1);
    assert.equal(warnings.mock.callCount(), 2);
  });

  it('ignores superseded requests and suppresses results after edits or deactivation', async t => {
    const document = {
      uri: { scheme: 'file', fsPath: '/project/entry.ts' }, languageId: 'typescript', isDirty: false, offsetAt: () => 17,
    } as unknown as TextDocument;
    window.activeTextEditor = { document, selection: { active: {} } } as TextEditor;
    workspace.textDocuments = [document];
    const registration = t.mock.method(commands, 'registerCommand');
    const show = t.mock.method(FlowLensGraphWebview.prototype, 'showGraph', async () => {});
    type AnalysisResult = Awaited<ReturnType<WorkspaceAnalysisService['analyze']>>;
    const pending: PromiseWithResolvers<AnalysisResult>[] = [];
    const analyze = t.mock.method(WorkspaceAnalysisService.prototype, 'analyze', async () => {
      const request = Promise.withResolvers<AnalysisResult>();
      pending.push(request);
      return request.promise;
    });
    const store = createExtensionStore();
    let extensionActive = true;
    const disposable = registerGenerateGraphCommand({
      analysisService: new WorkspaceAnalysisService(),
      graphWebview: new FlowLensGraphWebview(Uri.file('/extension') as VsCodeUri),
      store,
      isExtensionActive: () => extensionActive,
    });
    t.after(() => disposable.dispose());
    const command = registration.mock.calls.find(call => call.arguments[0] === 'flowlens.generateGraph')!.arguments[1];
    const first = command();
    const second = command();
    assert.deepEqual(analyze.mock.calls[0]!.arguments, ['/project/entry.ts', 17]);
    pending[1]!.resolve(ok({ nodes: [], edges: [] }));
    await second;
    pending[0]!.resolve(ok({ nodes: [], edges: [] }));
    await first;
    assert.equal(show.mock.callCount(), 1);
    const third = command();
    store.update(state => ({ ...state, documentRevision: state.documentRevision + 1 }));
    pending[2]!.resolve(ok({ nodes: [], edges: [] }));
    await third;
    assert.equal(show.mock.callCount(), 1);
    const fourth = command();
    extensionActive = false;
    pending[3]!.resolve(ok({ nodes: [], edges: [] }));
    await fourth;
    assert.equal(show.mock.callCount(), 1);
  });
});
