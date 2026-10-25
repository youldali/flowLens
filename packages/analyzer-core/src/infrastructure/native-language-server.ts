import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter, type MessageConnection } from 'vscode-jsonrpc/node.js';
import type { API, LanguageServerSnapshotChanges } from 'typescript-native/async';

import type { ImplementationLocation } from '#domain/implementation';

/** Owns one native server and its compiler API connection, sharing document state. */
export class NativeLanguageServer {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly connection: MessageConnection;
  private readonly versions = new Map<string, number>();
  private api: API<true> | undefined;
  private closed = false;
  private stderr = '';

  private constructor(root: string) {
    const resolvePackage = createRequire(import.meta.url);
    const require = createRequire(resolvePackage.resolve('typescript-native/package.json'));
    const platformPackage = require.resolve(`@typescript/typescript-${process.platform}-${process.arch}/package.json`);
    const executable = path.join(path.dirname(platformPackage), 'lib', process.platform === 'win32' ? 'tsc.exe' : 'tsc');
    this.child = spawn(executable, ['--lsp', '--stdio'], { cwd: root, stdio: 'pipe' });
    this.child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk.toString()).slice(-8192); });
    this.connection = createMessageConnection(new StreamMessageReader(this.child.stdout), new StreamMessageWriter(this.child.stdin));
    this.child.on('error', error => {
      this.stderr = `${this.stderr}\n${error.message}`;
      this.connection.dispose();
    });
    this.child.on('exit', () => this.connection.dispose());
    this.connection.onRequest('workspace/configuration', (params: { items: unknown[] }) => params.items.map(() => ({})));
    this.connection.onRequest('client/registerCapability', () => null);
    this.connection.listen();
  }

  static async create(root: string): Promise<NativeLanguageServer> {
    const { API } = await import('typescript-native/async');
    const server = new NativeLanguageServer(root);

    try {
      await server.request('initialize', {
        processId: process.pid,
        rootUri: pathToFileURL(root).href,
        capabilities: {},
        workspaceFolders: [{ uri: pathToFileURL(root).href, name: path.basename(root) }],
      });
      await server.connection.sendNotification('initialized', {});
      const { pipe } = await server.request<{ pipe: string }>('custom/initializeAPISession', {});
      server.api = await API.fromLSPConnection({ pipe });
      return server;
    } catch (error) {
      server.connection.dispose();
      server.child.kill();
      throw new Error(`Failed to start native TypeScript server for ${root}: ${server.stderr}`, { cause: error });
    }
  }

  async updateFile(file: string, text: string): Promise<void> {
    this.ensureOpen();
    const uri = pathToFileURL(file).href;
    const previous = this.versions.get(uri);
    const version = (previous ?? 0) + 1;

    if (previous === undefined) {
      await this.connection.sendNotification('textDocument/didOpen', {
        textDocument: { uri, languageId: file.endsWith('.tsx') ? 'typescriptreact' : 'typescript', version, text },
      });
    } else {
      await this.connection.sendNotification('textDocument/didChange', {
        textDocument: { uri, version }, contentChanges: [{ text }],
      });
    }

    this.versions.set(uri, version);
  }

  async findImplementations(file: string, line: number, character: number): Promise<ImplementationLocation[]> {
    const locations = await this.request<ImplementationLocation[] | null>('textDocument/implementation', {
      textDocument: { uri: pathToFileURL(file).href }, position: { line, character },
    });
    return locations ?? [];
  }

  async parseConfig(file: string) {
    this.ensureOpen();
    if (!this.api) throw new Error('Native TypeScript API is not initialized');
    const parsed = await this.api.parseConfigFile(file);
    const errors = parsed.errors.filter(error => error.code !== 18003);
    if (errors.length) {
      const { formatDiagnostics } = await import('typescript-native/async');
      throw new Error(formatDiagnostics(errors, this.api));
    }
    return parsed;
  }

  async getSnapshot(changes?: LanguageServerSnapshotChanges) {
    this.ensureOpen();
    if (!this.api) throw new Error('Native TypeScript API is not initialized');
    return this.api.getCurrentLanguageServerSnapshot(changes);
  }

  async dispose(): Promise<void> {
    if (this.closed) return;

    try {
      await this.api?.close();
      await this.request('shutdown');
      await this.connection.sendNotification('exit');
    } finally {
      this.closed = true;
      this.connection.dispose();
      this.child.kill();
    }
  }

  private async request<T>(method: string, params?: object): Promise<T> {
    this.ensureOpen();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        params === undefined ? this.connection.sendRequest<T>(method) : this.connection.sendRequest<T>(method, params),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Native TypeScript request timed out: ${method}`)), 30_000);
        }),
      ]);
    } catch (error) {
      throw new Error(`Native TypeScript request failed: ${method}: ${this.stderr}`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  private ensureOpen(): void {
    if (this.closed) throw new Error('Native TypeScript server is disposed');
  }
}
