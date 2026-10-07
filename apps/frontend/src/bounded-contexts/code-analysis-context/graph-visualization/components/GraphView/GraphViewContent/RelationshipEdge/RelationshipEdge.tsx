import { BaseEdge, type EdgeProps } from 'reactflow'
import type { GraphViewEdgeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { RELATIONSHIP_STROKE_DASHARRAY } from '../relationshipPresentation'
import { getRelationshipEdgePath } from './relationshipEdgePath'

export function RelationshipEdge(props: EdgeProps<GraphViewEdgeData>) {
  const { path, labelX, labelY } = getRelationshipEdgePath(props)

  return (
    <BaseEdge
      {...props}
      style={{
        ...props.style,
        strokeDasharray: props.data ? RELATIONSHIP_STROKE_DASHARRAY[props.data.relationship] : 'none',
      }}
      path={path}
      labelX={labelX}
      labelY={labelY}
      labelShowBg
      labelBgPadding={[8, 4]}
      labelBgBorderRadius={4}
    />
  )
}
