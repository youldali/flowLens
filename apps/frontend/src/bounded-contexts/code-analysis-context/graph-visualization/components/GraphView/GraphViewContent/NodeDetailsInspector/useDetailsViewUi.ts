import { useMemo } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import {
  createGraphNodeDetailsView,
  getSourceTarget,
} from '@code-analysis-context/graph-visualization/domain/nodeDetails'

interface UseDetailsViewUiOptions {
  graph: FlowGraph
  selectedNodeId: NodeId
  onOpenSource: ((filePath: string, offset: number) => void) | undefined
  onFocusNode: ((nodeId: NodeId) => void) | undefined
}

export function useDetailsViewUi({
  graph,
  selectedNodeId,
  onOpenSource,
  onFocusNode,
}: UseDetailsViewUiOptions) {
  const detailsView = useMemo(
    () => createGraphNodeDetailsView(graph, selectedNodeId),
    [graph, selectedNodeId],
  )
  const sourceTarget = detailsView && getSourceTarget(detailsView)
  const openSource = onOpenSource && sourceTarget
    ? () => onOpenSource(sourceTarget.filePath, sourceTarget.offset)
    : undefined
  const focusOnNode = onFocusNode && detailsView
    ? () => onFocusNode(detailsView.node.id)
    : undefined

  return { detailsView, openSource, focusOnNode }
}
