import { useMemo } from 'react'
import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import { createGraphNodeDetailsView } from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import { shouldDisplayNodeLocation } from '../nodePresentation'

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
  const sourceTarget = detailsView
    && shouldDisplayNodeLocation(detailsView.node.sourceOrigin)
    && detailsView.node.sourceOffset !== undefined
    ? { filePath: detailsView.node.filePath, offset: detailsView.node.sourceOffset }
    : undefined
  const openSource = onOpenSource && sourceTarget
    ? () => onOpenSource(sourceTarget.filePath, sourceTarget.offset)
    : undefined
  const focusOnNode = onFocusNode && detailsView
    ? () => onFocusNode(detailsView.node.id)
    : undefined

  return { detailsView, openSource, focusOnNode }
}
