import classNames from 'classnames'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type FitViewOptions,
  type NodeProps,
  type NodeTypes,
} from 'reactflow'
import { isEmpty } from '@flowlens/analyzer-core/flow-graph'
import { useConfig } from '@common/config'
import { graphFacade } from '@code-analysis-context/graph-visualization/adapters/graphFacade'
import type { GraphViewNodeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { GraphToolbar } from './GraphToolbar'
import { GraphNode } from './GraphNode'
import { NodeDetailsInspector } from './NodeDetailsInspector'
import styles from './GraphViewContent.module.css'
import { useEffectSelectionCleanup } from './useEffectSelectionCleanup'

export interface GraphViewContentProps {
  className?: string
  fitViewOptions?: FitViewOptions
}

const DEFAULT_FIT_VIEW_OPTIONS = { padding: 0.2 } satisfies FitViewOptions
const NODE_TYPES = {
  default: ({ data, selected }: NodeProps<GraphViewNodeData>) => (
    <GraphNode node={data} selected={selected} />
  ),
} satisfies NodeTypes

export function GraphViewContent(props: GraphViewContentProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}

function GraphCanvas({
  className,
  fitViewOptions = DEFAULT_FIT_VIEW_OPTIONS,
}: GraphViewContentProps) {
  const { runtimeHost } = useConfig()
  const originalGraph = graphFacade.data.useOriginalGraph()
  const transformedGraph = graphFacade.data.useTransformedGraph()
  const { nodes, edges } = graphFacade.data.useReactFlowGraph()
  const selectedNode = graphFacade.data.useSelectedNode()
  const fitView = graphFacade.actions.useFitView()
  const selectNode = graphFacade.actions.useSelectNodeMouseHandler()
  const clearSelection = graphFacade.actions.useClearSelection()
  useEffectSelectionCleanup()

  const entryNode = originalGraph.nodes[0]
  const rootLabel =
    entryNode?.kind === 'functionDeclaration' || entryNode?.kind === 'methodDeclaration'
      ? entryNode.name
      : undefined

  const isGraphEmpty = isEmpty(transformedGraph)
  const graphViewClassName = classNames(styles.graphView, className)

  return (
    <>
      <GraphToolbar
        onFitView={() => void fitView(fitViewOptions)}
        rootLabel={rootLabel}
      />
      <div className={classNames(
        styles.workspace,
        runtimeHost !== 'vscode' && styles.workspaceBrowser,
      )}>
        {isGraphEmpty ? (
          <div className={graphViewClassName}>
            <div className={styles.empty}>No graph data</div>
          </div>
        ) : (
          <>
            <div className={graphViewClassName}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                fitView
                fitViewOptions={fitViewOptions}
                onNodeClick={selectNode}
                onPaneClick={clearSelection}
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>
            {selectedNode && (
              <NodeDetailsInspector
                className={styles.inspectorContainer}
                node={selectedNode}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
