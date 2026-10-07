import classNames from 'classnames'
import { Handle, Position } from 'reactflow'
import type { GraphViewNodeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { shouldDisplayNodeLocation } from '../nodePresentation'
import { useNodeTranslations } from '../useNodeTranslations'
import styles from './GraphNode.module.css'

interface GraphNodeProps {
  node: GraphViewNodeData
  selected: boolean
  sourcePosition?: Position | undefined
  targetPosition?: Position | undefined
}

export function GraphNode({
  node,
  selected,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}: GraphNodeProps) {
  const nodeTranslations = useNodeTranslations()
  const showLocation = shouldDisplayNodeLocation(node.sourceOrigin)

  return (
    <div
      className={classNames(
        styles.node,
        node.sourceOrigin === 'project' ? styles.nodeProject : styles.nodeSecondary,
        selected && styles.nodeSelected,
      )}
    >
      <Handle type="target" position={targetPosition} />
      <span className={styles.nodeLabel} title={node.label}>{node.label}</span>
      <span className={styles.nodeCategory}>
        {nodeTranslations.category(node.kind, node.sourceOrigin)}
      </span>
      {showLocation && (
        <span className={styles.nodeFileName} title={node.fileName}>{node.fileName}</span>
      )}
      <Handle type="source" position={sourcePosition} />
    </div>
  )
}
