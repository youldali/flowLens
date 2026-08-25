import type {
  AnalyzerNode,
  CallExpressionNode,
  FileNode,
  FunctionDeclarationNode,
  SerializedGraphNode,
} from '../node.js';
import { createFixture } from '@flowlens/test-utils';
import {
  callExpressionFixture,
  functionDeclarationFixture,
  sourceFileFixture,
} from './ts-node.js';

const nodeFixture: AnalyzerNode = {
  id: "fixture-node",
  kind: "file",
  name: "fixture.ts",
  filePath: "fixture.ts",
  sourceOrigin: "project",
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

const serializedNodeFixture: SerializedGraphNode = {
  id: "fixture-node",
  kind: "functionDeclaration",
  name: "fixtureFunction",
  filePath: "fixture.ts",
  sourceOrigin: "project",
};

export const create = createFixture<AnalyzerNode>(nodeFixture);
export const createFileNode = createFixture<FileNode>(fileNodeFixture);
export const createFunctionDeclarationNode = createFixture<FunctionDeclarationNode>(functionDeclarationNodeFixture);
export const createCallExpressionNode = createFixture<CallExpressionNode>(callExpressionNodeFixture);
export const createSerializedNode = createFixture<SerializedGraphNode>(serializedNodeFixture);
