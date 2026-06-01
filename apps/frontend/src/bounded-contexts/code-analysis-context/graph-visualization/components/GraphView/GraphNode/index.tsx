import { Handle, Position, type NodeProps } from 'reactflow'
import type { GraphViewNodeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import styles from '../GraphView.module.css'

export function GraphNode({ data }: NodeProps<GraphViewNodeData>) {
  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <span className={styles.nodeLabel}>{data.label}</span>
      <span className={styles.nodeMeta}>{data.kind}</span>
      <span className={styles.nodeMeta}>{data.filePath}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
