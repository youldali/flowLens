import * as ts from 'typescript-native/ast';

import { normalizePath } from '@flowlens/common/fs';
import type { NodeId } from '../../domain/node.js';

export function createFileId(sourceFile: ts.SourceFile): NodeId {
  return normalizePath(sourceFile.fileName);
}

export function deriveIdFromTsNode(node: ts.Node): NodeId {
  const sourceFile = node.getSourceFile();
  return `${sourceFile.fileName}:${node.kind}:${node.pos}:${node.end}`;
}
