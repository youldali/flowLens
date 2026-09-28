import ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';

export function findNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
): Result<ts.Node, 'not-found'> {
  let nodeAtPosition: ts.Node | undefined;

  function visit(node: ts.Node): void {
    if (
      position < node.getStart(sourceFile) ||
      position >= node.getEnd()
    ) {
      return;
    }

    nodeAtPosition = node;
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return !nodeAtPosition ? err('not-found') : ok(nodeAtPosition);
}
