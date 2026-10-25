import * as path from 'node:path';
import type { SourceFile } from 'typescript-native/ast';
import { normalizePath } from '@flowlens/common/fs';

export function buildImplementation(source: SourceFile, location: ImplementationLocation): ImplementationEntry {
  const { start, end } = location.range;
  const offset = source.getPositionOfLineAndCharacter(start.line, start.character);
  const endOffset = source.getPositionOfLineAndCharacter(end.line, end.character);
  const filePath = normalizePath(source.fileName);

  return {
    name: source.text.slice(offset, endOffset) || path.basename(filePath),
    filePath,
    line: start.line + 1,
    column: start.character + 1,
    offset,
  };
}

export interface ImplementationLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface ImplementationEntry {
  name: string;
  filePath: string;
  line: number;
  column: number;
  offset: number;
}
