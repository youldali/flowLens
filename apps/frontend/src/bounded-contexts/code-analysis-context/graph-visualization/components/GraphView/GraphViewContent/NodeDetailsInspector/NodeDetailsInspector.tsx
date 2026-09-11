import type { FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import type { NodeId } from '@flowlens/analyzer-core/node'
import { NodeDetailsInspectorView } from './NodeDetailsInspectorView'
import { useDetailsViewUi } from './useDetailsViewUi'

export interface NodeDetailsInspectorProps {
  graph: FlowGraph
  selectedNodeId: NodeId
  className?: string | undefined
  onClose: () => void
  onSelectNode: (nodeId: NodeId) => void
  onOpenSource?: (filePath: string, offset: number) => void
  onFocusNode?: (nodeId: NodeId) => void
}

export function NodeDetailsInspector({
  graph,
  selectedNodeId,
  className,
  onClose,
  onSelectNode,
  onOpenSource,
  onFocusNode,
}: NodeDetailsInspectorProps) {
  const {
    detailsView,
    openSource,
    focusOnNode,
  } = useDetailsViewUi({
    graph,
    selectedNodeId,
    onOpenSource,
    onFocusNode,
  })

  return detailsView && (
    <NodeDetailsInspectorView
      {...detailsView}
      className={className}
      onClose={onClose}
      onSelectNode={onSelectNode}
      {...(openSource ? { onOpenSource: openSource } : {})}
      {...(focusOnNode ? { onFocusNode: focusOnNode } : {})}
    />
  )
}
