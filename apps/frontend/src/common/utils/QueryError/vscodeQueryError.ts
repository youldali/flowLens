import { isQueryError, type QueryError } from './queryError'

export interface VsCodeQueryError<TReason extends string = string> extends QueryError {
  readonly transport: 'vscode'
  readonly reason: TReason
  readonly operation: string
  readonly requestId?: string | undefined
}

export class VsCodeQueryErrorClass<TReason extends string> extends Error implements VsCodeQueryError<TReason> {
  readonly isQueryError = true as const
  readonly transport = 'vscode' as const
  readonly reason: TReason
  readonly operation: string
  readonly requestId?: string | undefined
  readonly originalError?: Error | undefined

  constructor({ reason, operation, requestId, cause }: {
    reason: TReason
    operation: string
    requestId?: string
    cause?: unknown
  }) {
    super(`VS Code request failure: ${operation}, ${reason}`, { cause })
    this.name = 'VsCodeQueryError'
    this.reason = reason
    this.operation = operation
    this.requestId = requestId
    this.originalError = cause instanceof Error ? cause : undefined
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      transport: this.transport,
      reason: this.reason,
      operation: this.operation,
      requestId: this.requestId,
    }
  }
}

export const isVsCodeQueryError = <TReason extends string = string>(
  error: unknown,
): error is VsCodeQueryError<TReason> =>
  isQueryError(error) && error.transport === 'vscode'
