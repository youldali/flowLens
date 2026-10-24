import { API } from 'typescript-native/sync';
import type { Node, ScriptTarget, ScriptKind } from 'typescript-native/ast';
export * from 'typescript-native/ast';
export type { Checker as TypeChecker, Program, Signature, Symbol, Type } from 'typescript-native/async';

// Pure AST fixtures do not retain remote semantic handles after parsing.
export function createSourceFile(file: string, text: string, _target?: ScriptTarget, _parents?: boolean, scriptKind?: ScriptKind) {
  using api = new API();
  using lease = api.createSourceFile(file, text, { scriptKind });
  return lease.sourceFile;
}

export function forEachChild<T>(node: Node, visitor: (child: Node) => T) {
  return node.forEachChild(visitor);
}
