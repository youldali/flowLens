import ts from 'typescript';

import { createFixture } from './create-fixture.js';

export const sourceFileFixture = ts.createSourceFile(
  "fixture.ts",
  `
function fixtureFunction() {
  return dependency();
}

class FixtureClass {
  constructor() {}

  method() {
    return this.dependency();
  }

  get value() {
    return 1;
  }

  set value(value: number) {}
}

const arrowFixture = () => dependency();
const functionExpressionFixture = function expressionFixture() {
  return dependency();
};

dependency();

const variableFixture = 1;
`,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const findNode = <T extends ts.Node>(
  predicate: (node: ts.Node) => node is T,
): T => {
  let match: T | undefined;

  const visit = (node: ts.Node): void => {
    if (match) {
      return;
    }

    if (predicate(node)) {
      match = node;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFileFixture);

  if (!match) {
    throw new Error("Fixture node not found");
  }

  return match;
};

export const nodeFixture: ts.Node = sourceFileFixture;
export const callExpressionFixture = findNode(ts.isCallExpression);
export const functionDeclarationFixture = findNode(ts.isFunctionDeclaration);
export const methodDeclarationFixture = findNode(ts.isMethodDeclaration);
export const constructorDeclarationFixture = findNode(ts.isConstructorDeclaration);
export const functionExpressionFixture = findNode(ts.isFunctionExpression);
export const arrowFunctionFixture = findNode(ts.isArrowFunction);
export const getAccessorDeclarationFixture = findNode(ts.isGetAccessorDeclaration);
export const setAccessorDeclarationFixture = findNode(ts.isSetAccessorDeclaration);
export const variableStatementNodeFixture = findNode(ts.isVariableStatement);

export const create = createFixture<ts.Node>(nodeFixture);
export const createSourceFile = createFixture<ts.SourceFile>(sourceFileFixture);
export const createCallExpression = createFixture<ts.CallExpression>(callExpressionFixture);
export const createFunctionDeclaration = createFixture<ts.FunctionDeclaration>(functionDeclarationFixture);
export const createMethodDeclaration = createFixture<ts.MethodDeclaration>(methodDeclarationFixture);
export const createConstructorDeclaration = createFixture<ts.ConstructorDeclaration>(constructorDeclarationFixture);
export const createFunctionExpression = createFixture<ts.FunctionExpression>(functionExpressionFixture);
export const createArrowFunction = createFixture<ts.ArrowFunction>(arrowFunctionFixture);
export const createGetAccessorDeclaration = createFixture<ts.GetAccessorDeclaration>(getAccessorDeclarationFixture);
export const createSetAccessorDeclaration = createFixture<ts.SetAccessorDeclaration>(setAccessorDeclarationFixture);
export const createVariableStatementNode = createFixture<ts.VariableStatement>(variableStatementNodeFixture);
