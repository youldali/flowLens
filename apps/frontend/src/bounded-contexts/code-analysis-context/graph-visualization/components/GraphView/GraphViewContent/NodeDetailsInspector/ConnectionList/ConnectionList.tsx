import type { NodeId } from '@flowlens/analyzer-core/node'
import type { GraphConnectionSummary } from '@code-analysis-context/graph-visualization/domain/nodeDetails'
import { useNodeTranslations } from '../../useNodeTranslations'
import styles from './ConnectionList.module.css'

interface ConnectionListProps {
  heading: string
  connections: GraphConnectionSummary[]
  onSelectNode: (nodeId: NodeId) => void
}

export function ConnectionList({ heading, connections, onSelectNode }: ConnectionListProps) {
  const nodeTranslations = useNodeTranslations()

  return connections.length > 0 && (
    <div className={styles.connectionGroup}>
      <h4>{heading}</h4>
      <ul>
        {connections.map((connection) => (
          <li key={connection.edgeId}>
            <button type="button" onClick={() => onSelectNode(connection.connectedNodeId)}>
              <span title={connection.name}>{connection.name}</span>
              <small>{nodeTranslations.relationship(connection.relationship)}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
