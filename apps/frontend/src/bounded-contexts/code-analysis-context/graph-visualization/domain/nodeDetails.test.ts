import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import {
  createCallExpressionNode,
  createFunctionDeclarationNode,
  createUnresolvedCallDeclarationNode,
} from '@flowlens/analyzer-core/fixtures/node'
import {
  createGraphNodeConnectionSummaries,
  getSourceExcerpt,
  getSourceOffset,
  getSourceTarget,
  hasConnections,
  type GraphNodeConnectionSummaries,
} from './nodeDetails'

const processNode = createFunctionDeclarationNode({
  id: '/project/src/process.ts:10:90',
  name: 'process',
  filePath: '/project/src/process.ts',
  fileName: 'process.ts',
  jsdoc: 'Processes the current request.',
})
const repositoryNode = createFunctionDeclarationNode({
  id: '/project/src/repository.ts:100:180',
  kind: 'methodDeclaration',
  name: 'customerRepository.list',
  filePath: '/project/src/repository.ts',
  fileName: 'repository.ts',
})
const unresolvedNode = createUnresolvedCallDeclarationNode({
  id: 'unresolved-call-declaration:/project/src/process.ts:42:58',
  name: 'database.query',
  filePath: '/project/src/process.ts',
  fileName: 'process.ts',
  start: 42,
  end: 58,
})

const graph: FlowGraph = {
  nodes: [processNode, repositoryNode, unresolvedNode],
  edges: [
    createEdge({
      id: 'repository->process:calls',
      source: repositoryNode.id,
      target: processNode.id,
    }),
    createEdge({
      id: 'process->database:calls',
      source: processNode.id,
      target: unresolvedNode.id,
    }),
  ],
}

describe('createGraphNodeConnectionSummaries', () => {
  it('builds connection summaries from the loaded graph', () => {
    assert.deepEqual(createGraphNodeConnectionSummaries(graph, processNode.id), {
      incomingConnections: [{
        edgeId: 'repository->process:calls',
        connectedNodeId: '/project/src/repository.ts:100:180',
        name: 'customerRepository.list',
        relationship: 'calls',
      }],
      outgoingConnections: [{
        edgeId: 'process->database:calls',
        connectedNodeId: 'unresolved-call-declaration:/project/src/process.ts:42:58',
        name: 'database.query',
        relationship: 'calls',
      }],
    })
  })

  it('returns empty summaries when the selected node is not in the graph', () => {
    assert.deepEqual(createGraphNodeConnectionSummaries(graph, 'missing'), {
      incomingConnections: [],
      outgoingConnections: [],
    })
  })
})

describe('getSourceOffset', () => {
  it('returns the start offset for node kinds that represent calls', () => {
    const callExpressionNode = createCallExpressionNode({ start: 17 })

    assert.equal(getSourceOffset(callExpressionNode), 17)
    assert.equal(getSourceOffset(unresolvedNode), 42)
  })

  it('returns undefined for nodes without a source offset', () => {
    assert.equal(getSourceOffset(processNode), undefined)
  })
})

describe('getSourceExcerpt', () => {
  it('returns source text only for call expression nodes', () => {
    const callExpressionNode = createCallExpressionNode({ text: 'process()' })

    assert.equal(getSourceExcerpt(callExpressionNode), 'process()')
    assert.equal(getSourceExcerpt(processNode), undefined)
  })
})

describe('hasConnections', () => {
  const connectionSummaries: GraphNodeConnectionSummaries = {
    incomingConnections: [],
    outgoingConnections: [],
  }
  const connection = {
    edgeId: 'repository->process:calls',
    connectedNodeId: 'repository',
    name: 'repository',
    relationship: 'calls' as const,
  }

  it('returns false without connections', () => {
    assert.equal(hasConnections(connectionSummaries), false)
  })

  it('returns true with an incoming connection', () => {
    assert.equal(hasConnections({
      ...connectionSummaries,
      incomingConnections: [connection],
    }), true)
  })

  it('returns true with an outgoing connection', () => {
    assert.equal(hasConnections({
      ...connectionSummaries,
      outgoingConnections: [connection],
    }), true)
  })
})

describe('getSourceTarget', () => {
  it('returns the source target for a displayable node with an offset', () => {
    assert.deepEqual(getSourceTarget(unresolvedNode), {
      filePath: '/project/src/process.ts',
      offset: 42,
    })
  })

  it('returns undefined when the source location should not be displayed', () => {
    assert.equal(getSourceTarget({
      ...unresolvedNode,
      sourceOrigin: 'external',
    }), undefined)
  })

  it('returns undefined when the node has no source offset', () => {
    assert.equal(getSourceTarget(processNode), undefined)
  })
})
