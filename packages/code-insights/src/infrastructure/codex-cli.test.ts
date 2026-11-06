import assert from 'node:assert/strict';
import childProcess, { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { describe, it, type TestContext } from 'node:test';
import { assertErr, assertOk } from '@flowlens/common/testing';
import { runCodex } from './codex-cli.js';

const request = {
  workspaceDirectory: '/workspace with spaces',
  prompt: 'Summarize the project: $(literal) `text`',
  outputSchemaPath: '/schemas/project-summary.json',
  outputPath: '/output/project-summary.json',
};

describe('runCodex', () => {
  it('runs a read-only request with caller-supplied prompt, schema, and output paths', async context => {
    const spawn = mockCodex(context);
    const result = await runCodex(request);
    assertOk(result);
    assert.equal(result.value, undefined);
    const call = spawn.mock.calls[0]!;
    assert.deepEqual(call.arguments, ['codex', [
      'exec', '--sandbox', 'read-only', '--ephemeral', '--config', 'approval_policy="never"',
      '--cd', request.workspaceDirectory, '--skip-git-repo-check',
      '--output-schema', request.outputSchemaPath, '--output-last-message', request.outputPath, '-',
    ], {
      cwd: request.workspaceDirectory, shell: false, detached: process.platform !== 'win32',
      windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'],
    }]);
    assert.equal((call.result!.stdin as PassThrough).read().toString(), request.prompt);
  });

  it('does not spawn for an already cancelled request', async context => {
    const spawn = mockCodex(context);
    const result = await runCodex({ ...request, abortSignal: AbortSignal.abort() });
    assertErr(result);
    assert.deepEqual(result.error, { reason: 'cancelled' });
    assert.equal(spawn.mock.callCount(), 0);
  });

  it('preserves process failures', async context => {
    const cause = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    mockCodex(context, { error: cause });
    const result = await runCodex(request);
    assertErr(result);
    assert.deepEqual(result.error, { reason: 'execution-failed', cause });
  });

  it('reports nonzero exits with bounded, redacted diagnostics and does not guess authentication status', async context => {
    mockCodex(context, {
      code: 1,
      stderr: 'Authentication failed Bearer credential-value api_key="secret-key" sk-example-key eyJabc.abcdef.signature\n' + 'x'.repeat(20_000),
    });
    const result = await runCodex(request);
    assertErr(result);
    assert.equal(result.error.reason, 'execution-failed');
    if (result.error.reason !== 'execution-failed') throw new Error('Expected execution failure');
    assert.ok(result.error.cause instanceof Error);
    assert.match(result.error.cause.message, /code 1/);
    assert.match(result.error.cause.message, /Authentication failed/);
    assert.doesNotMatch(result.error.cause.message, /credential-value|secret-key|sk-example-key|eyJabc/);
    assert.ok(result.error.cause.message.length < 8500);
  });
});

function mockCodex(context: TestContext, behavior: { code?: number; stderr?: string; error?: Error } = {}) {
  return context.mock.method(childProcess, 'spawn', () => {
    const child = new ChildProcess();
    child.stdin = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin.once('finish', () => {
      if (behavior.stderr) child.stderr!.emit('data', Buffer.from(behavior.stderr));
      if (behavior.error) child.emit('error', behavior.error);
      child.emit('close', behavior.code ?? (behavior.error ? -1 : 0), null);
    });
    return child;
  });
}
