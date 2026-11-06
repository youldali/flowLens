import childProcess, { type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { err, ok, type Result } from 'neverthrow';
import { ResultFlow } from '@youldali/result-flow';

export type CodexExecutionError =
  | { reason: 'codex-not-available' }
  // Reserved for a reliably identified authentication failure; CLI text is not a contract.
  | { reason: 'codex-not-authenticated' }
  | { reason: 'execution-failed'; cause: unknown }
  | { reason: 'cancelled' };

const terminationGraceMs = 1_000;

interface CodexRequest {
  workspaceDirectory: string;
  prompt: string;
  outputSchemaPath: string;
  outputPath: string;
  abortSignal?: AbortSignal | undefined;
}

interface CodexExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  processFailure: Error | undefined;
  cancelled: boolean;
}

export function runCodex(request: CodexRequest): Promise<Result<void, CodexExecutionError>> {
  return ResultFlow.from(() => spawnCodex(request))
    .chain(async child => classifyCodexExit(await waitForCodex(child, request)))
    .precondition<CodexExecutionError>(
      () => !request.abortSignal?.aborted,
      () => ({ reason: 'cancelled' }),
    )
    .run();
}

function spawnCodex({ workspaceDirectory, outputSchemaPath, outputPath }: CodexRequest): Result<ChildProcess, CodexExecutionError> {
  const args = [
    'exec', '--sandbox', 'read-only', '--ephemeral',
    '--config', 'approval_policy="never"',
    '--cd', workspaceDirectory, '--skip-git-repo-check',
    '--output-schema', outputSchemaPath, '--output-last-message', outputPath, '-',
  ];

  try {
    return ok(childProcess.spawn('codex', args, {
      cwd: workspaceDirectory,
      shell: false,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe'],
    }));
  } catch (cause) {
    if (hasCode(cause, 'ENOENT')) return err({ reason: 'codex-not-available' });
    if (cause instanceof Error && 'syscall' in cause) return err({ reason: 'execution-failed', cause });
    throw cause;
  }
}

async function waitForCodex(child: ChildProcess, { prompt, abortSignal }: CodexRequest): Promise<CodexExit> {
  let stderr = '';
  let processFailure: Error | undefined;
  let termination: Promise<void> | undefined;
  let hasClosed = false;
  const closed = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>();
  const onAbort = () => {
    termination ??= terminateProcessTree(child).catch(cause => {
      throw new Error('Failed to terminate the Codex process tree', { cause });
    });
    // Unblock the close wait if termination fails before the process can exit.
    void termination.catch(closed.reject);
  };
  const onError = (cause: Error) => { processFailure = hasCode(cause, 'ENOENT') ? cause : processFailure ?? cause; };
  const onStderr = (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(0, 8192); };
  child.once('close', (code, signal) => {
    hasClosed = true;
    closed.resolve({ code, signal });
  });
  child.on('error', onError);
  child.stdin?.on('error', onError);
  child.stderr?.on('data', onStderr);
  abortSignal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (abortSignal?.aborted) onAbort();
    else child.stdin?.end(prompt);
    const { code, signal } = await closed.promise;
    await termination;
    return { code, signal, stderr, processFailure, cancelled: abortSignal?.aborted ?? false };
  } catch (cause) {
    if (!hasClosed && !termination) {
      try {
        await terminateProcessTree(child);
        await closed.promise;
      } catch (cleanupCause) {
        throw new AggregateError([cause, cleanupCause], 'Codex process failed and could not be terminated');
      }
    }
    throw cause;
  } finally {
    abortSignal?.removeEventListener('abort', onAbort);
    child.removeListener('error', onError);
    child.stdin?.removeListener('error', onError);
    child.stderr?.removeListener('data', onStderr);
  }
}

function classifyCodexExit({ code, signal, stderr, processFailure, cancelled }: CodexExit): Result<void, CodexExecutionError> {
  if (cancelled) return err({ reason: 'cancelled' });
  if (hasCode(processFailure, 'ENOENT')) return err({ reason: 'codex-not-available' });
  if (processFailure) return err({ reason: 'execution-failed', cause: processFailure });

  return code === 0
    ? ok(undefined)
    : err({
      reason: 'execution-failed',
      cause: new Error(`Codex exited with code ${code}, signal ${signal}: ${redactDiagnostics(stderr)}`),
    });
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      childProcess.execFile('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, error => {
        if (error) reject(error);
        else resolve();
      });
    });
    return;
  }

  const signalGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch (cause) {
      if (!hasCode(cause, 'ESRCH')) throw cause;
    }
  };
  signalGroup('SIGTERM');
  // The leader may exit before its descendants; still escalate the whole group.
  await delay(terminationGraceMs);
  signalGroup('SIGKILL');
}

function hasCode(cause: unknown, code: string): boolean {
  return cause instanceof Error && 'code' in cause && cause.code === code;
}

function redactDiagnostics(stderr: string): string {
  return stderr
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[\w-]+/g, '[REDACTED]')
    .replace(/\beyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?/g, '[REDACTED]')
    .replace(/(["']?(?:[\w-]*(?:token|secret|password)|[\w-]*api[_-]?key)["']?\s*[:=]\s*)["']?[^\s,"'}]+["']?/gi, '$1[REDACTED]');
}
