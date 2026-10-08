import classNames from 'classnames'
import { Handle, Position } from 'reactflow'
import type { GraphViewNodeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { getNodeHighlightState } from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import { shouldDisplayNodeLocation } from '../nodePresentation'
import { useNodeTranslations } from '../useNodeTranslations'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import styles from './GraphNode.module.css'

interface GraphNodeProps {
  id: string
  node: GraphViewNodeData
  selected: boolean
  sourcePosition?: Position | undefined
  targetPosition?: Position | undefined
}

export function GraphNode({
  id,
  node,
  selected,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}: GraphNodeProps) {
  const highlightedEdge = graphFacade.data.useHighlightedEdge()
  const highlightState = getNodeHighlightState(id, highlightedEdge)
  const nodeTranslations = useNodeTranslations()
  const showLocation = shouldDisplayNodeLocation(node.sourceOrigin)

  return (
    <div
      data-connection-state={highlightState}
      className={classNames(
        styles.node,
        node.sourceOrigin === 'project' ? styles.nodeProject : styles.nodeSecondary,
        selected && styles.nodeSelected,
        highlightState === 'highlighted' && styles.nodeConnected,
        highlightState === 'dimmed' && !selected && styles.nodeDimmed,
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
