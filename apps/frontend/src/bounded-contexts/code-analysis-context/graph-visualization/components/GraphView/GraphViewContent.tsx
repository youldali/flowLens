import classNames from 'classnames'
import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type FitViewOptions,
  type NodeTypes,
} from 'reactflow'
import type { Graph } from '@flowlens/graph-model'
import {
  adaptToReactFlow,
  type ReactFlowAdapterOptions,
} from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import { GraphNode } from './GraphNode'
import styles from './GraphView.module.css'

export interface GraphViewContentProps {
  graph: Graph
  className?: string
  direction?: ReactFlowAdapterOptions['direction']
  fitViewOptions?: FitViewOptions
  nodeTypes?: NodeTypes
}

const DEFAULT_LAYOUT_DIRECTION = 'LR' satisfies ReactFlowAdapterOptions['direction']
const DEFAULT_FIT_VIEW_OPTIONS = { padding: 0.2 } satisfies FitViewOptions
const DEFAULT_NODE_TYPES = {
  default: GraphNode,
} satisfies NodeTypes

export function GraphViewContent({
  graph,
  className,
  direction = DEFAULT_LAYOUT_DIRECTION,
  fitViewOptions = DEFAULT_FIT_VIEW_OPTIONS,
  nodeTypes = DEFAULT_NODE_TYPES,
}: GraphViewContentProps) {
  const { nodes, edges } = useMemo(
    () => adaptToReactFlow(graph, { direction }),
    [direction, graph],
  )

  const isEmpty = nodes.length === 0 && edges.length === 0
  const graphViewClassName = classNames(styles.graphView, className)

  return (
    <div className={graphViewClassName}>
      {isEmpty ? <div className={styles.empty}>No graph data</div> : null}
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
