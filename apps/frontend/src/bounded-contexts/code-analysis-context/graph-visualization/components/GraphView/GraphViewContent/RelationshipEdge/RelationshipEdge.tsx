import type { HighlightState } from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import classNames from 'classnames'
import { BaseEdge, type EdgeProps } from 'reactflow'
import type { GraphViewEdgeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { RELATIONSHIP_STROKE_DASHARRAY } from '../relationshipPresentation'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import styles from './RelationshipEdge.module.css'
import { getRelationshipEdgePath } from './relationshipEdgePath'

export function RelationshipEdge(props: EdgeProps<GraphViewEdgeData>) {
  const highlightedEdge = graphFacade.data.useHighlightedEdge()
  const highlightState: HighlightState = highlightedEdge
    ? (highlightedEdge.id === props.id ? 'highlighted' : 'dimmed')
    : 'none'
  const highlighted = highlightState === 'highlighted'
  const { path, labelX, labelY } = getRelationshipEdgePath(props)

  return (
    <g
      className={classNames(styles.edge, highlightState === 'dimmed' && styles.dimmed)}
      data-connection-state={highlightState}
    >
      <BaseEdge
        {...props}
        style={{
          ...props.style,
          ...(highlighted ? { stroke: 'var(--graph-focus-border, var(--accent))', strokeWidth: 3 } : {}),
          strokeDasharray: props.data ? RELATIONSHIP_STROKE_DASHARRAY[props.data.relationship] : 'none',
        }}
        path={path}
        labelX={labelX}
        labelY={labelY}
        labelShowBg
        labelBgPadding={[8, 4]}
        labelBgBorderRadius={4}
      />
    </g>
  )
}
