import type { GraphId } from '@flowlens/analyzer-core/domain/graph-session'
import { createContext } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph'

export type OnOpenSource = (filePath: string, offset: number) => void

export interface GraphContextValue {
  graphId: GraphId
  graph: FlowGraph
  onOpenSource: OnOpenSource | undefined
}

export const GraphContext = createContext<GraphContextValue | undefined>(undefined)
