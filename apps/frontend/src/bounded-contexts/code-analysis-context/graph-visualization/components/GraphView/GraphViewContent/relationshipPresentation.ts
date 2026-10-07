import type { EdgeType } from '@flowlens/analyzer-core/domain/edge'

export const RELATIONSHIP_STROKE_DASHARRAY = {
  calls: 'none',
  declares: '6 4',
  imports: 'none',
  references: 'none',
} satisfies Record<EdgeType, string>
