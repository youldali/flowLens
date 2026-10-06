import ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';

export type ExecutableFunctionDeclaration =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

export type TypeCallableDeclaration =
  | (ts.PropertySignature & {
      parent: ts.InterfaceDeclaration | ts.TypeLiteralNode;
      type: ts.FunctionTypeNode;
    })
  | (ts.MethodSignature & {
      parent: ts.InterfaceDeclaration | ts.TypeLiteralNode;
    });

export type CallableDeclaration =
  | ExecutableFunctionDeclaration
  | TypeCallableDeclaration;

export function findEnclosingFunction(
  node: ts.Node,
): Result<ExecutableFunctionDeclaration, 'not-found'> {
  let current: ts.Node | undefined = node;

  while (current) {
    if (isExecutableFunction(current)) {
      return ok(current);
    }

    current = current.parent;
  }

  return err('not-found');
}

/**
 * Narrow to ONLY real executable function-like nodes (have bodies)
 */
export function isExecutableFunction(
  node: ts.Node,
): node is ExecutableFunctionDeclaration {
  return ts.isFunctionLike(node) && (node as any).body && (node as any).body != null;

  // return (
  //   ts.isFunctionDeclaration(node) ||
  //   ts.isMethodDeclaration(node) ||
  //   ts.isConstructorDeclaration(node) ||
  //   ts.isFunctionExpression(node) ||
  //   ts.isArrowFunction(node) ||
  //   ts.isGetAccessorDeclaration(node) ||
  //   ts.isSetAccessorDeclaration(node)
  // );
}

export function isTypeCallableDeclaration(
  node: ts.Node,
): node is TypeCallableDeclaration {
  if (
    !node.parent ||
    (!ts.isInterfaceDeclaration(node.parent) && !ts.isTypeLiteralNode(node.parent))
  ) {
    return false;
  }

  return ts.isMethodSignature(node)
    || (ts.isPropertySignature(node) && !!node.type && ts.isFunctionTypeNode(node.type));
}

export function getExecutableFunctionKind(
  node: ExecutableFunctionDeclaration,
): 'functionDeclaration' | 'methodDeclaration' {
  return ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isAccessor(node)
    ? 'methodDeclaration'
    : 'functionDeclaration';
}
