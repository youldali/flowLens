import { getSmoothStepPath, Position } from 'reactflow'

// Room for the longest relationship ("references"), padding, and the arrow.
const LABEL_DISTANCE = 68
const TARGET_SEGMENT_LENGTH = 116
const SHORT_EDGE_LABEL_OFFSET = 60
const DIRECTIONS = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
}

type PathOptions = Parameters<typeof getSmoothStepPath>[0]

export function getRelationshipEdgePath(options: PathOptions) {
  const { sourceX, sourceY, targetX, targetY, targetPosition = Position.Top } = options
  const direction = DIRECTIONS[targetPosition]
  const horizontal = direction.x !== 0
  const distance = horizontal ? Math.abs(targetX - sourceX) : Math.abs(targetY - sourceY)
  const segmentLength = horizontal ? TARGET_SEGMENT_LENGTH : 48
  const short = distance < segmentLength * 2
  const labelDistance = short ? Math.min(20, distance / 4) : (horizontal ? LABEL_DISTANCE : 30)
  const [path] = getSmoothStepPath({
    ...options,
    offset: short ? Math.min(20, distance / 2) : segmentLength,
  })

  // Crowded/manual layouts cannot fit a label inline. Lift it beside the
  // destination branch, clear of the node (88px high) and its arrowhead.
  return {
    path,
    labelX: targetX + direction.x * labelDistance + (!horizontal && short ? 168 : 0),
    labelY: targetY + direction.y * labelDistance - (horizontal && short ? SHORT_EDGE_LABEL_OFFSET : 0),
  }
}
