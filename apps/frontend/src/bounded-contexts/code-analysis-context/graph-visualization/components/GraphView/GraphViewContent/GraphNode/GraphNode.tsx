import classNames from 'classnames'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { GraphViewNodeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { shouldDisplayNodeLocation } from '../nodePresentation'
import { useNodeTranslations } from '../useNodeTranslations'
import styles from './GraphNode.module.css'

export function GraphNode({ data, selected }: NodeProps<GraphViewNodeData>) {
  const nodeTranslations = useNodeTranslations()
  const showLocation = shouldDisplayNodeLocation(data.sourceOrigin)

  return (
    <div
      className={classNames(
        styles.node,
        data.sourceOrigin === 'project' ? styles.nodeProject : styles.nodeSecondary,
        selected && styles.nodeSelected,
      )}
    >
      <Handle type="target" position={Position.Left} />
      <span className={styles.nodeLabel} title={data.label}>{data.label}</span>
      <span className={styles.nodeCategory}>
        {nodeTranslations.category(data.kind, data.sourceOrigin)}
      </span>
      {showLocation && (
        <span className={styles.nodeFileName} title={data.fileName}>{data.fileName}</span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
