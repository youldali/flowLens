import type {
  CallExpressionNode,
  FileNode,
  FunctionDeclarationNode,
  Node,
} from '../node.js';
import { createFixture } from './create-fixture.js';
import {
  callExpressionFixture,
  functionDeclarationFixture,
  sourceFileFixture,
} from './ts-node.js';

const nodeFixture: Node = {
  id: "fixture-node",
  kind: "file",
  name: "fixture.ts",
  filePath: "fixture.ts",
  tsNode: sourceFileFixture,
};

const fileNodeFixture: FileNode = {
  ...nodeFixture,
  id: "fixture.ts",
  kind: "file",
  name: "fixture.ts",
  filePath: "fixture.ts",
  tsNode: sourceFileFixture,
};

const functionDeclarationNodeFixture: FunctionDeclarationNode = {
  ...nodeFixture,
  id: "fixture.ts:1:49",
  kind: "functionDeclaration",
  name: "fixtureFunction",
  filePath: "fixture.ts",
  signature: undefined,
  tsNode: functionDeclarationFixture,
};

const callExpressionNodeFixture: CallExpressionNode = {
  ...nodeFixture,
  id: "fixture.ts:33:45",
  kind: "callExpression",
  name: "dependency",
  filePath: "fixture.ts",
  tsNode: callExpressionFixture,
  signature: undefined,
  declarationTsNode: functionDeclarationFixture,
  declarationFile: "fixture.ts",
};

export const create = createFixture<Node>(nodeFixture);
export const createFileNode = createFixture<FileNode>(fileNodeFixture);
export const createFunctionDeclarationNode = createFixture<FunctionDeclarationNode>(functionDeclarationNodeFixture);
export const createCallExpressionNode = createFixture<CallExpressionNode>(callExpressionNodeFixture);
