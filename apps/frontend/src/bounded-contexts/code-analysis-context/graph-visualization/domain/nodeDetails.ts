import type { Edge, EdgeId, EdgeType } from '@flowlens/analyzer-core/domain/edge'
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph'
import {
  isCallExpressionNode,
  isUnresolvedCallDeclarationNode,
  type Node,
  type NodeId,
} from '@flowlens/analyzer-core/domain/node'

export type HighlightState = 'highlighted' | 'dimmed' | 'none'

export interface GraphConnectionSummary {
  edgeId: EdgeId
  connectedNodeId: NodeId
  name: string
  relationship: EdgeType
}

export interface GraphNodeConnectionSummaries {
  incomingConnections: GraphConnectionSummary[]
  outgoingConnections: GraphConnectionSummary[]
}

export function getNodeHighlightState(
  nodeId: NodeId,
  highlightedEdge: Edge | undefined,
): HighlightState {
  return highlightedEdge
    ? (highlightedEdge.source === nodeId || highlightedEdge.target === nodeId ? 'highlighted' : 'dimmed')
    : 'none'
}

export function hasConnections(connectionSummaries: GraphNodeConnectionSummaries): boolean {
  return connectionSummaries.incomingConnections.length > 0
    || connectionSummaries.outgoingConnections.length > 0
}

export function getSourceTarget(
  node: Node,
): { filePath: string, offset: number } | undefined {
  const sourceOffset = getSourceOffset(node)

  return (node.sourceOrigin === 'project' || node.sourceOrigin === 'unknown')
    && sourceOffset !== undefined
    ? { filePath: node.filePath, offset: sourceOffset }
    : undefined
}

export function createGraphNodeConnectionSummaries(
  graph: FlowGraph,
  nodeId: NodeId,
): GraphNodeConnectionSummaries {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))

  return {
    incomingConnections: graph.edges
      .filter((edge) => edge.target === nodeId)
      .flatMap((edge) => toConnectionSummary(edge, edge.source, nodesById)),
    outgoingConnections: graph.edges
      .filter((edge) => edge.source === nodeId)
      .flatMap((edge) => toConnectionSummary(edge, edge.target, nodesById)),
  }
}

export function getSourceOffset(node: Node): number | undefined {
  return isCallExpressionNode(node) || isUnresolvedCallDeclarationNode(node)
    ? node.start
    : undefined
}

export function getSourceExcerpt(node: Node): string | undefined {
  return isCallExpressionNode(node) ? node.text : undefined
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
    name: connectedNode.displayName ?? connectedNode.name,
    relationship: edge.type,
  }] : []
}
