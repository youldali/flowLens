import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flowGraphSchema } from './flow-graph-contract.js';
import { createFileNode as createNode, createFunctionDeclarationNode } from '../fixtures/node.js';

describe('flowGraphSchema', () => {
  it('preserves presentation names while accepting legacy nodes', () => {
    const graph = {
      nodes: [createNode({ name: 'anonymous', displayName: 'click handler' }), createNode({ id: 'legacy' })],
      edges: [],
    };
    assert.deepEqual(flowGraphSchema.parse(graph), graph);
  });

  it('preserves implementation source and offsets through JSON serialization for functions and methods', () => {
    const graph = {
      nodes: [
        createFunctionDeclarationNode(),
        createFunctionDeclarationNode({ id: 'method', kind: 'methodDeclaration', sourceText: 'run() { return 1; }' }),
      ],
      edges: [],
    };

    assert.deepEqual(flowGraphSchema.parse(JSON.parse(JSON.stringify(graph))), graph);
  });

  it('rejects function and method nodes without string source text', () => {
    for (const kind of ['functionDeclaration', 'methodDeclaration'] as const) {
      for (const sourceText of [undefined, 42]) {
        const node = { ...createFunctionDeclarationNode({ kind }), sourceText };

        assert.equal(flowGraphSchema.safeParse({ nodes: [node], edges: [] }).success, false);
      }
    }
  });

  it('requires nonnegative integer offsets for functions and methods', () => {
    for (const kind of ['functionDeclaration', 'methodDeclaration'] as const) {
      for (const field of ['start', 'end']) {
        for (const value of [undefined, -1, 1.5, '1']) {
          const node = { ...createFunctionDeclarationNode({ kind }), [field]: value };

          assert.equal(flowGraphSchema.safeParse({ nodes: [node], edges: [] }).success, false);
        }
      }
    }
  });
});
