import { BaseEdge, type EdgeProps } from 'reactflow'
import { getRelationshipEdgePath } from './relationshipEdgePath'

export function RelationshipEdge(props: EdgeProps) {
  const { path, labelX, labelY } = getRelationshipEdgePath(props)

  return (
    <BaseEdge
      {...props}
      path={path}
      labelX={labelX}
      labelY={labelY}
      labelShowBg
      labelBgPadding={[8, 4]}
      labelBgBorderRadius={4}
    />
  )
}
