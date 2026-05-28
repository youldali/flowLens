import type { Edge as FlowEdge, Node as FlowNode } from 'reactflow'
import { MarkerType } from 'reactflow'
import type { Graph, GraphNode } from '@flowlens/graph-model'

export interface GraphViewNodeData extends Record<string, unknown> {
  label: string
  kind: GraphNode['kind']
  filePath: string
}

export interface ReactFlowGraph {
  nodes: FlowNode<GraphViewNodeData>[]
  edges: FlowEdge[]
}

export function toReactFlow(graph: Graph): ReactFlowGraph {
  return {
    nodes: graph.nodes.map(toReactFlowNode),
    edges: graph.edges.map((edge) => ({
      id: String(edge.id),
      source: String(edge.source),
      target: String(edge.target),
      label: edge.type,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      type: 'smoothstep',
      animated: false,
    })),
  }
}

function toReactFlowNode(node: GraphNode): FlowNode<GraphViewNodeData> {
  return {
    id: String(node.id),
    data: {
      label: node.name,
      kind: node.kind,
      filePath: node.filePath,
    },
    position: { x: 0, y: 0 },
  }
}
