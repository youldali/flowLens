import ts from 'typescript';
import { err, ok, type Result } from 'neverthrow';
import {
  findFirstMeaningfulParent,
  getExpressionName,
  getPropertyName,
  getUnwrappedExpression,
} from './expressions.js';
import type { ExecutableFunctionDeclaration } from './functions.js';

const CONSTRUCTOR_FUNCTION_NAME = 'constructor';
const ANONYMOUS_FUNCTION_NAME = 'anonymous';
const ADD_EVENT_LISTENER_NAME = 'addEventListener';
const EVENT_HANDLER_SUFFIX = 'handler';
const CALLBACK_SUFFIX = 'callback';

/** Preserve the existing source/assignment name independently of presentation. */
export function getExecutableFunctionName(
  node: ExecutableFunctionDeclaration,
  sourceFile: ts.SourceFile,
): string {
  if ('name' in node && node.name) {
    return node.name.getText(sourceFile);
  }

  const parent = node.parent;
  if (parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent))) {
    return parent.name.getText(sourceFile);
  }

  return ts.isConstructorDeclaration(node) ? CONSTRUCTOR_FUNCTION_NAME : ANONYMOUS_FUNCTION_NAME;
}

/** Syntax-only names with a stable source-line fallback. */
export function getDisplayName(node: ExecutableFunctionDeclaration): string {
  const semanticName = inferSemanticName(node);
  if (semanticName.isOk()) {
    return semanticName.value;
  }

  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${ANONYMOUS_FUNCTION_NAME} at line ${line + 1}`;
}

function inferSemanticName(node: ExecutableFunctionDeclaration): Result<string, 'not-found'> {
  if ('name' in node && node.name) {
    return ok(node.name.getText(node.getSourceFile()));
  }
  if (ts.isConstructorDeclaration(node)) {
    return ok(CONSTRUCTOR_FUNCTION_NAME);
  }

  const { directChild, parent } = findFirstMeaningfulParent(node);
  if (!parent) {
    return err('not-found');
  }

  if (ts.isVariableDeclaration(parent) && parent.initializer === directChild) {
    return ts.isIdentifier(parent.name) ? ok(parent.name.text) : err('not-found');
  }
  if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent))
    && parent.initializer === directChild) {
    const propertyName = getPropertyName(parent.name);
    return propertyName ? ok(propertyName) : err('not-found');
  }
  if (ts.isBinaryExpression(parent)
    && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && parent.right === directChild) {
    return getExpressionName(getUnwrappedExpression(parent.left));
  }
  if (ts.isCallExpression(parent)) {
    const argumentIndex = parent.arguments.findIndex((argument) => argument === directChild);
    if (argumentIndex < 0) {
      return err('not-found');
    }
    const calleeResult = getExpressionName(getUnwrappedExpression(parent.expression));
    if (calleeResult.isErr()) {
      return err(calleeResult.error);
    }
    const callee = calleeResult.value;
    return ok(inferEventHandlerName(parent, callee, argumentIndex)
      .unwrapOr(`${callee} ${CALLBACK_SUFFIX}`));
  }

  return err('not-found');
}

// Infers a handler name from a static event passed to `addEventListener`.
// For example, `addEventListener('click', () => {})` yields `click handler`.
function inferEventHandlerName(
  callExpression: ts.CallExpression,
  callee: string,
  argumentIndex: number,
): Result<string, 'not-found'> {
  if (callee !== ADD_EVENT_LISTENER_NAME || argumentIndex !== 1) {
    return err('not-found');
  }

  const eventArgument = callExpression.arguments[0];
  const event = eventArgument ? getUnwrappedExpression(eventArgument) : undefined;
  return event && ts.isStringLiteralLike(event) && event.text.length > 0
    ? ok(`${event.text} ${EVENT_HANDLER_SUFFIX}`)
    : err('not-found');
}
