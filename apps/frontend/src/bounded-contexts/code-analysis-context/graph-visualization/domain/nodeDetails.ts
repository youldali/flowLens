import type { Edge, EdgeId, EdgeType } from '@flowlens/analyzer-core/edge'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import {
  isCallExpressionNode,
  isUnresolvedCallDeclarationNode,
  type Node,
  type NodeId,
} from '@flowlens/analyzer-core/node'

export interface GraphConnectionSummary {
  edgeId: EdgeId
  connectedNodeId: NodeId
  name: string
  relationship: EdgeType
}

export interface GraphNodeDetails {
  id: NodeId
  name: string
  kind: Node['kind']
  sourceOrigin: Node['sourceOrigin']
  fileName: string
  filePath: string
  sourceOffset?: number
  sourceExcerpt?: string
}

export interface GraphNodeDetailsView {
  node: GraphNodeDetails
  incomingConnections: GraphConnectionSummary[]
  outgoingConnections: GraphConnectionSummary[]
}

export function hasConnections(nodeDetails: GraphNodeDetailsView): boolean {
  return nodeDetails.incomingConnections.length > 0
    || nodeDetails.outgoingConnections.length > 0
}

export function createGraphNodeDetailsView(
  graph: FlowGraph,
  nodeId: NodeId,
): GraphNodeDetailsView | undefined {
  const selectedNode = graph.nodes.find((node) => node.id === nodeId)

  if (!selectedNode) {
    return undefined
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))

  return {
    node: toGraphNodeDetails(selectedNode),
    incomingConnections: graph.edges
      .filter((edge) => edge.target === nodeId)
      .flatMap((edge) => toConnectionSummary(edge, edge.source, nodesById)),
    outgoingConnections: graph.edges
      .filter((edge) => edge.source === nodeId)
      .flatMap((edge) => toConnectionSummary(edge, edge.target, nodesById)),
  }
}

function toGraphNodeDetails(node: Node): GraphNodeDetails {
  const sourceOffset = getSourceOffset(node)
  const sourceExcerpt = isCallExpressionNode(node)
    ? node.text
    : undefined

  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    sourceOrigin: node.sourceOrigin,
    fileName: node.fileName,
    filePath: node.filePath,
    ...(sourceOffset === undefined ? {} : { sourceOffset }),
    ...(sourceExcerpt ? { sourceExcerpt } : {}),
  }
}

function getSourceOffset(node: Node): number | undefined {
  return isCallExpressionNode(node) || isUnresolvedCallDeclarationNode(node)
    ? node.start
    : undefined
}

function toConnectionSummary(
  edge: Edge,
  connectedNodeId: NodeId,
  nodesById: Map<NodeId, Node>,
): GraphConnectionSummary[] {
  const connectedNode = nodesById.get(connectedNodeId)

  return connectedNode ? [{
    edgeId: edge.id,
    connectedNodeId: connectedNode.id,
    name: connectedNode.name,
    relationship: edge.type,
  }] : []
}
