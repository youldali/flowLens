import ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';

// Finds the first parent that changes the naming context and the direct child leading to it.
// The direct child is the original node or its outermost transparent wrapper.
// For example, in `const validate = ((() => {}) as Handler)`, it returns the variable
// declaration as `parent` and the wrapped initializer as `directChild`.
export function findFirstMeaningfulParent(node: ts.Node): {
  directChild: ts.Node;
  parent: ts.Node | undefined;
} {
  let directChild = node;
  while (directChild.parent && isTransparentExpression(directChild.parent)) {
    directChild = directChild.parent;
  }
  return { directChild, parent: directChild.parent };
}

// These nodes wrap an expression without changing the naming context inferred from its parent.
// For example, `const validate = (() => {}) as Handler` should still infer `validate`.
export function isTransparentExpression(node: ts.Node): node is
  | ts.ParenthesizedExpression
  | ts.AsExpression
  | ts.TypeAssertion
  | ts.NonNullExpression
  | ts.SatisfiesExpression {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)
    || ts.isSatisfiesExpression(node);
}

// Removes transparent wrappers and returns their innermost expression.
// For example, `((callback as Handler)!)` unwraps to `callback`.
export function getUnwrappedExpression(node: ts.Expression): ts.Expression {
  return isTransparentExpression(node) ? getUnwrappedExpression(node.expression) : node;
}

// Returns the text of a non-empty string-like or numeric literal.
// For example, `"submit"` yields `submit` and `42` yields `42`.
export function getLiteralName(node: ts.Node): string | undefined {
  return (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) && node.text.length > 0
    ? node.text
    : undefined;
}

// Returns a statically known property label; for example, `{"submit": () => {}}` yields `submit`.
// A computed property name uses brackets, such as `[key]` or `["submit"]`, to provide the key.
export function getPropertyName(node: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
    return node.text;
  }
  return ts.isComputedPropertyName(node)
    ? getLiteralName(getUnwrappedExpression(node.expression))
    : getLiteralName(node);
}

// Returns the final static label; for example, `obj.nested.submit` yields `submit`.
export function getExpressionName(node: ts.Expression): Result<string, 'not-found'> {
  if (ts.isIdentifier(node)) {
    return ok(node.text);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return ok(node.name.text);
  }
  const literalName = ts.isElementAccessExpression(node)
    ? getLiteralName(getUnwrappedExpression(node.argumentExpression))
    : undefined;
  return literalName ? ok(literalName) : err('not-found');
}
