import type { Edge as FlowEdge, Node as FlowNode } from 'reactflow'
import { MarkerType } from 'reactflow'
import type { Edge as AnalyzerEdge, EdgeMetadata } from '@flowlens/analyzer-core/edge'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { Node } from '@flowlens/analyzer-core/node'

export interface GraphViewNodeData extends Record<string, unknown> {
  label: string
  kind: Node['kind']
  filePath: string
  sourceOrigin: Node['sourceOrigin']
}

export interface GraphViewEdgeData extends Record<string, unknown> {
  metadata: EdgeMetadata
}

export interface ReactFlowGraph {
  nodes: FlowNode<GraphViewNodeData>[]
  edges: FlowEdge<GraphViewEdgeData>[]
}

export function toReactFlow(graph: FlowGraph): ReactFlowGraph {
  return {
    nodes: graph.nodes.map(toReactFlowNode),
    edges: graph.edges.map(toReactFlowEdge),
  }
}

function toReactFlowEdge(edge: AnalyzerEdge): FlowEdge<GraphViewEdgeData> {
  return {
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    label: edge.type,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    type: 'smoothstep',
    animated: false,
    ...(edge.metadata ? { data: { metadata: edge.metadata } } : {}),
  }
}

function toReactFlowNode(node: Node): FlowNode<GraphViewNodeData> {
  return {
    id: String(node.id),
    data: {
      label: node.name,
      kind: node.kind,
      filePath: node.filePath,
      sourceOrigin: node.sourceOrigin,
    },
    position: { x: 0, y: 0 },
  }
}
