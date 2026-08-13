import * as path from 'node:path'

export { findNearestTsconfig } from './fs/index.js';

export type PipeTransform<T> = (value: T) => T;

export function pipe<T>(value: T, ...transforms: Array<PipeTransform<T>>): T {
  return transforms.reduce((currentValue, transform) => transform(currentValue), value);
}

export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replaceAll(path.sep, '/');
}
