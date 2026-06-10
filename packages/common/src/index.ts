import * as path from 'node:path'

export { findNearestTsconfig } from './fs/index.js';

export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replaceAll(path.sep, '/');
}
