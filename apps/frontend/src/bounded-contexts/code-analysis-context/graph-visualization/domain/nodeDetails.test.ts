import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { create as createEdge } from '@flowlens/analyzer-core/fixtures/edge'
import {
  createFunctionDeclarationNode,
  createUnresolvedCallDeclarationNode,
} from '@flowlens/analyzer-core/fixtures/node'
import {
  createGraphNodeDetailsView,
  getSourceTarget,
  hasConnections,
  type GraphNodeDetailsView,
} from './nodeDetails'
import { create as createNodeDetailsView } from './fixtures/node-details'

const processNode = createFunctionDeclarationNode({
  id: '/project/src/process.ts:10:90',
  name: 'process',
  filePath: '/project/src/process.ts',
  fileName: 'process.ts',
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

describe('createGraphNodeDetailsView', () => {
  it('builds identity and connection details from the loaded graph', () => {
    assert.deepEqual(createGraphNodeDetailsView(graph, processNode.id), {
      node: {
        id: '/project/src/process.ts:10:90',
        name: 'process',
        kind: 'functionDeclaration',
        sourceOrigin: 'project',
        fileName: 'process.ts',
        filePath: '/project/src/process.ts',
      },
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
  it('uses only the node start property as its source offset', () => {
    assert.equal(
      createGraphNodeDetailsView(
        graph,
        unresolvedNode.id,
      )?.node.sourceOffset,
      42,
    )
    assert.equal(
      createGraphNodeDetailsView(graph, processNode.id)?.node.sourceOffset,
      undefined,
    )
  })

  it('returns undefined when the selected node is no longer in the transformed graph', () => {
    assert.equal(createGraphNodeDetailsView(graph, 'missing'), undefined)
  })

  it('preserves location data for non-project nodes', () => {
    const externalNode = createFunctionDeclarationNode({
      id: 'external',
      filePath: '/project/node_modules/library/index.d.ts',
      fileName: 'index.d.ts',
      sourceOrigin: 'external',
    })
    const details = createGraphNodeDetailsView(
      { nodes: [externalNode], edges: [] },
      externalNode.id,
    )

    assert.equal(details?.node.fileName, 'index.d.ts')
    assert.equal(details?.node.filePath, '/project/node_modules/library/index.d.ts')
  })
})

describe('hasConnections', () => {
  const nodeDetails: GraphNodeDetailsView = {
    node: {
      id: 'process',
      name: 'process',
      kind: 'functionDeclaration',
      sourceOrigin: 'project',
      fileName: 'process.ts',
      filePath: '/project/src/process.ts',
    },
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
    assert.equal(hasConnections(nodeDetails), false)
  })

  it('returns true with an incoming connection', () => {
    assert.equal(hasConnections({
      ...nodeDetails,
      incomingConnections: [connection],
    }), true)
  })

  it('returns true with an outgoing connection', () => {
    assert.equal(hasConnections({
      ...nodeDetails,
      outgoingConnections: [connection],
    }), true)
  })
})

describe('getSourceTarget', () => {
  const nodeDetails = createNodeDetailsView()

  it('returns the source target for a displayable node with an offset', () => {
    assert.deepEqual(getSourceTarget(nodeDetails), {
      filePath: '/project/src/process.ts',
      offset: 42,
    })
  })

  it('returns undefined when the source location should not be displayed', () => {
    assert.equal(getSourceTarget({
      ...nodeDetails,
      node: { ...nodeDetails.node, sourceOrigin: 'external' },
    }), undefined)
  })

  it('returns undefined when the node has no source offset', () => {
    const node = { ...nodeDetails.node }
    delete node.sourceOffset

    assert.equal(getSourceTarget({ ...nodeDetails, node }), undefined)
  })
})
