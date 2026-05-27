import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type FitViewOptions,
  type NodeTypes,
} from 'reactflow'
import type { Graph } from '@flowlens/graph-model'
import { layoutDagre, type LayoutDirection } from '../../presentation/layoutDagre'
import { toReactFlow } from '../../presentation/toReactFlow'
import { GraphNode } from './GraphNode'
import './GraphView.css'

export interface GraphViewProps {
  graph: Graph
  className?: string
  direction?: LayoutDirection
  fitViewOptions?: FitViewOptions
  nodeTypes?: NodeTypes
}

const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = 'LR'
const DEFAULT_FIT_VIEW_OPTIONS = { padding: 0.2 } satisfies FitViewOptions
const DEFAULT_NODE_TYPES = {
  default: GraphNode,
} satisfies NodeTypes

export function GraphView({
  graph,
  className,
  direction = DEFAULT_LAYOUT_DIRECTION,
  fitViewOptions = DEFAULT_FIT_VIEW_OPTIONS,
  nodeTypes = DEFAULT_NODE_TYPES,
}: GraphViewProps) {
  const { nodes, edges } = useMemo(() => {
    const flowGraph = toReactFlow(graph)

    return {
      nodes: layoutDagre(flowGraph.nodes, flowGraph.edges, { direction }),
      edges: flowGraph.edges,
    }
  }, [direction, graph])

  const isEmpty = nodes.length === 0 && edges.length === 0
  const graphViewClassName = className ? `graph-view ${className}` : 'graph-view'

  return (
    <div className={graphViewClassName}>
      {isEmpty ? <div className="graph-view__empty">No graph data</div> : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={fitViewOptions}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
