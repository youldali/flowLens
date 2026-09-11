import type { NodeId } from '@flowlens/analyzer-core/node'

export type NodeSelectionAction =
  | { type: 'select'; nodeId: NodeId }
  | { type: 'clear' }

export function reduceNodeSelection(
  _selectedNodeId: NodeId | undefined,
  action: NodeSelectionAction,
): NodeId | undefined {
  return action.type === 'select' ? action.nodeId : undefined
}

export function getNodeSelectionKeyboardAction(
  key: string,
): NodeSelectionAction | undefined {
  return key === 'Escape' ? { type: 'clear' } : undefined
}
