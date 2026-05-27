import { Handle, Position, type NodeProps } from 'reactflow'
import type { GraphViewNodeData } from '../../../presentation/toReactFlow'

export function GraphNode({ data }: NodeProps<GraphViewNodeData>) {
  return (
    <div className="graph-view__node">
      <Handle type="target" position={Position.Left} />
      <span className="graph-view__node-label">{data.label}</span>
      <span className="graph-view__node-meta">{data.kind}</span>
      <span className="graph-view__node-meta">{data.filePath}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
