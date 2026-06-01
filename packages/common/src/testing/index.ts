import type { Err, Ok, Result } from 'neverthrow';

export function assertOk<T, E>(
  result: Result<T, E>,
): asserts result is Ok<T, E> {
  if (result.isErr()) {
    throw new Error(`Expected Result to be ok, received err: ${String(result.error)}`);
  }
}

export function assertErr<T, E>(
  result: Result<T, E>,
): asserts result is Err<T, E> {
  if (result.isOk()) {
    throw new Error(`Expected Result to be err, received ok: ${String(result.value)}`);
  }
}
