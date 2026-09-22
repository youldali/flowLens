import { createContext } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'

export type OnOpenSource = (filePath: string, offset: number) => void

export interface GraphContextValue {
  graph: FlowGraph
  onOpenSource: OnOpenSource | undefined
}

export const GraphContext = createContext<GraphContextValue | undefined>(undefined)
