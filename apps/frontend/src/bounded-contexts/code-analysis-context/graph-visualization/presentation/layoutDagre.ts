import dagre from 'dagre'
import { Position, type Edge as FlowEdge, type Node as FlowNode } from 'reactflow'

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL'

export interface DagreLayoutOptions {
  direction?: LayoutDirection
  nodeWidth?: number
  nodeHeight?: number
  rankSeparation?: number
  nodeSeparation?: number
}

const DEFAULT_NODE_WIDTH = 220
const DEFAULT_NODE_HEIGHT = 72
const DEFAULT_RANK_SEPARATION = 120
const DEFAULT_NODE_SEPARATION = 80

export function layoutDagre<TData extends Record<string, unknown>>(
  nodes: FlowNode<TData>[],
  edges: FlowEdge[],
  options: DagreLayoutOptions = {},
): FlowNode<TData>[] {
  const direction = options.direction ?? 'LR'
  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH
  const nodeHeight = options.nodeHeight ?? DEFAULT_NODE_HEIGHT
  const isHorizontal = direction === 'LR' || direction === 'RL'
  const dagreGraph = new dagre.graphlib.Graph()

  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: options.rankSeparation ?? DEFAULT_RANK_SEPARATION,
    nodesep: options.nodeSeparation ?? DEFAULT_NODE_SEPARATION,
  })

  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  dagre.layout(dagreGraph)

  return nodes.map((node) => {
    const positionedNode = dagreGraph.node(node.id)

    return {
      ...node,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      position: {
        x: positionedNode.x - nodeWidth / 2,
        y: positionedNode.y - nodeHeight / 2,
      },
    }
  })
}
