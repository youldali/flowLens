import type {
  CallExpressionNode,
  FileNode,
  FunctionDeclarationNode,
  CallableTypeMemberDeclarationNode,
  Node,
  UnresolvedCallDeclarationNode,
} from '../node.js';
import { createFixture } from '@flowlens/test-utils';

const nodeFixture: Node = {
  id: "fixture-node",
  kind: "functionDeclaration",
  name: "fixtureFunction",
  filePath: "fixture.ts",
  fileName: "fixture.ts",
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
  displayName: "fixtureFunction",
  id: "fixture.ts:1:49",
  kind: "functionDeclaration",
  name: "fixtureFunction",
  filePath: "fixture.ts",
};

const callableTypeMemberDeclarationNodeFixture: CallableTypeMemberDeclarationNode = {
  ...nodeFixture,
  id: "fixture.ts:300:329",
  kind: "callableTypeMemberDeclaration",
  name: "property",
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

const unresolvedCallDeclarationNodeFixture: UnresolvedCallDeclarationNode = {
  ...nodeFixture,
  id: "unresolved-call-declaration:fixture.ts:33:45",
  kind: "unresolved-call-declaration",
  name: "dependency",
  filePath: "fixture.ts",
  sourceOrigin: "unknown",
  start: 33,
  end: 45,
};

export const create = createFixture<Node>(nodeFixture);
export const createNode = create;
export const createFileNode = createFixture<FileNode>(fileNodeFixture);
const functionDeclarationFixture = createFixture<FunctionDeclarationNode>(functionDeclarationNodeFixture);
export const createFunctionDeclarationNode = (overrides: Partial<FunctionDeclarationNode> = {}): FunctionDeclarationNode =>
  functionDeclarationFixture({
    ...overrides,
    displayName: overrides.displayName ?? overrides.name ?? functionDeclarationNodeFixture.displayName,
  });
export const createCallableTypeMemberDeclarationNode = createFixture<CallableTypeMemberDeclarationNode>(
  callableTypeMemberDeclarationNodeFixture,
);
export const createCallExpressionNode = createFixture<CallExpressionNode>(callExpressionNodeFixture);
export const createUnresolvedCallDeclarationNode = createFixture<UnresolvedCallDeclarationNode>(
  unresolvedCallDeclarationNodeFixture,
);
