import * as path from 'node:path'

export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replaceAll(path.sep, '/');
}
