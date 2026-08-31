import type {
  CallExpressionNode,
  FileNode,
  FunctionDeclarationNode,
  SerializedGraphNode,
} from '../node.js';
import { createFixture } from '@flowlens/test-utils';

const nodeFixture: SerializedGraphNode = {
  id: "fixture-node",
  kind: "file",
  name: "fixture.ts",
  filePath: "fixture.ts",
  sourceOrigin: "project",
};

const fileNodeFixture: FileNode = {
  ...nodeFixture,
  id: "fixture.ts",
  kind: "file",
  name: "fixture.ts",
  filePath: "fixture.ts",
};

const functionDeclarationNodeFixture: FunctionDeclarationNode = {
  ...nodeFixture,
  id: "fixture.ts:1:49",
  kind: "functionDeclaration",
  name: "fixtureFunction",
  filePath: "fixture.ts",
};

const callExpressionNodeFixture: CallExpressionNode = {
  ...nodeFixture,
  id: "fixture.ts:33:45",
  kind: "callExpression",
  name: "dependency",
  filePath: "fixture.ts",
  start: 33,
  end: 45,
  text: "dependency()",
  declarationFile: "fixture.ts",
};

const serializedNodeFixture: SerializedGraphNode = {
  id: "fixture-node",
  kind: "functionDeclaration",
  name: "fixtureFunction",
  filePath: "fixture.ts",
  sourceOrigin: "project",
};

export const create = createFixture<SerializedGraphNode>(nodeFixture);
export const createFileNode = createFixture<FileNode>(fileNodeFixture);
export const createFunctionDeclarationNode = createFixture<FunctionDeclarationNode>(functionDeclarationNodeFixture);
export const createCallExpressionNode = createFixture<CallExpressionNode>(callExpressionNodeFixture);
export const createSerializedNode = createFixture<SerializedGraphNode>(serializedNodeFixture);
