export interface QueryError extends Error {
  readonly isQueryError: true
  readonly transport: 'http' | 'vscode'
  readonly originalError?: Error | undefined
  toJSON(): object
}

export const isQueryError = (error: unknown): error is QueryError =>
  error instanceof Error
  && 'isQueryError' in error && error.isQueryError === true
  && 'transport' in error && (error.transport === 'http' || error.transport === 'vscode')
