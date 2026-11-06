import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import { findWorkspaceRoot } from '@flowlens/common/fs';
import { ResultFlow } from '@youldali/result-flow';
import { err, ok, type Result } from 'neverthrow';
import type { FunctionExplanation } from '#domain/function-explanation';
import { functionExplanationSchema } from '#domain/function-explanation-contract';
import { runCodex, type CodexExecutionError } from './codex-cli.js';
import { buildFunctionExplanationPrompt } from './prompts/function-explanation.js';

export type CodexCliError =
  | CodexExecutionError
  | { reason: 'workspace-not-directory' }
  | { reason: 'invalid-output'; cause: unknown }
  | { reason: 'timeout' };

const defaultTimeoutMs = 120_000;
const temporaryDirectoryPrefix = 'flowlens-codex-';
const explanationSchemaPath = fileURLToPath(new URL('./function-explanation.schema.json', import.meta.url));

export function explainWithCodex(
  node: FunctionDeclarationNode,
  options: { timeoutMs?: number } = {},
): ResultFlow<FunctionExplanation, CodexCliError> {
  const requestedTimeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const timeoutMs = Number.isInteger(requestedTimeoutMs) && requestedTimeoutMs > 0 && requestedTimeoutMs <= 2_147_483_647
    ? requestedTimeoutMs
    : defaultTimeoutMs;

  return generateExplanation(node).timeout({
    ms: timeoutMs,
    onTimeout: (): CodexCliError => ({ reason: 'timeout' }),
  });
}

function generateExplanation(
  node: FunctionDeclarationNode,
): ResultFlow<FunctionExplanation, CodexCliError> {
  return ResultFlow.from(async () => {
    const workspaceDirectory = findWorkspaceRoot(node.filePath);
    // spawn reports ENOENT for either a missing cwd or executable; disambiguate first.
    return (await fs.stat(workspaceDirectory)).isDirectory()
      ? ok({ workspaceDirectory, temporaryDirectory: await fs.mkdtemp(path.join(os.tmpdir(), temporaryDirectoryPrefix)) })
      : err<never, CodexCliError>({ reason: 'workspace-not-directory' });
  })
    .catch(cause => { throw new Error('Failed to generate a Codex function explanation', { cause }); })
    .chain(({ workspaceDirectory, temporaryDirectory }, { abortSignal }) => {
      const outputPath = path.join(temporaryDirectory, 'explanation.json');

      return ResultFlow.from(() => {
        const { system, prompt } = buildFunctionExplanationPrompt(node, {
          repositoryContext: { workspaceDirectory, filePath: path.resolve(node.filePath) },
        });
        
        return runCodex({
          workspaceDirectory,
          prompt: `${system}\n\n${prompt}`,
          outputSchemaPath: explanationSchemaPath,
          outputPath,
          abortSignal,
        });
      })
        .chain(async (): Promise<Result<FunctionExplanation, CodexCliError>> => {
          if (abortSignal?.aborted) return err({ reason: 'cancelled' });

          return readExplanation(outputPath);
        })
        .catch(cause => { throw new Error('Failed to generate a Codex function explanation', { cause }); })
        .finally(async exit => {
          try {
            await fs.rm(temporaryDirectory, { recursive: true, force: true });
          } catch (cause) {
            const cleanupError = new Error('Failed to remove Codex temporary files', { cause });
            if (exit.kind === 'ok') throw cleanupError;

            throw new AggregateError(
              [exit.kind === 'err' ? exit.error : exit.cause, cleanupError],
              'Codex explanation and cleanup failed',
            );
          }
        });
    })
    .precondition<CodexCliError>(
      ({ abortSignal }) => !abortSignal?.aborted,
      () => ({ reason: 'cancelled' }),
    );
}

async function readExplanation(outputPath: string): Promise<Result<FunctionExplanation, CodexCliError>> {
  let text: string;

  try {
    text = await fs.readFile(outputPath, 'utf8');
  } catch (cause) {
    if (hasCode(cause, 'ENOENT')) return err({ reason: 'invalid-output', cause });
    throw cause;
  }

  let output: unknown;

  try {
    output = JSON.parse(text);
  } catch (cause) {
    if (cause instanceof SyntaxError) return err({ reason: 'invalid-output', cause });
    throw cause;
  }

  const result = functionExplanationSchema.safeParse(output);
  return result.success ? ok(result.data) : err({ reason: 'invalid-output', cause: result.error });
}

function hasCode(cause: unknown, code: string): boolean {
  return cause instanceof Error && 'code' in cause && cause.code === code;
}
