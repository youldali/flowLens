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
import { isEmpty, type FlowGraph } from '@flowlens/analyzer-core/flow-graph'
import { useConfig } from '@common/config'
import type { ReactFlowAdapterOptions } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter'
import type { GraphViewNodeData } from '@code-analysis-context/graph-visualization/adapters/ReactFlowAdapter/toReactFlow'
import { GraphToolbar } from './GraphToolbar'
import { GraphNode } from './GraphNode'
import { NodeDetailsInspector } from './NodeDetailsInspector'
import { useGraphUi } from './useGraphUi'
import styles from './GraphViewContent.module.css'

export interface GraphViewContentProps {
  graph: FlowGraph
  className?: string
  direction?: ReactFlowAdapterOptions['direction']
  fitViewOptions?: FitViewOptions
  onOpenSource?: (filePath: string, offset: number) => void
}

const DEFAULT_LAYOUT_DIRECTION = 'LR' satisfies ReactFlowAdapterOptions['direction']
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
  graph,
  className,
  direction = DEFAULT_LAYOUT_DIRECTION,
  fitViewOptions = DEFAULT_FIT_VIEW_OPTIONS,
  onOpenSource,
}: GraphViewContentProps) {
  const { runtimeHost } = useConfig()
  const entryNode = graph.nodes[0]
  const rootLabel =
    entryNode?.kind === 'functionDeclaration' || entryNode?.kind === 'methodDeclaration'
      ? entryNode.name
      : undefined
  const {
    displayGraph,
    nodes,
    edges,
    selectedNodeId,
    fitView,
    focusOnNode,
    selectAndFocusNode,
    selectNode,
    clearSelection,
  } = useGraphUi({
    graph,
    direction,
  })

  const isGraphEmpty = isEmpty(displayGraph)
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
            {selectedNodeId && (
              <NodeDetailsInspector
                className={styles.inspectorContainer}
                graph={displayGraph}
                selectedNodeId={selectedNodeId}
                onClose={clearSelection}
                onSelectNode={selectAndFocusNode}
                onFocusNode={focusOnNode}
                {...(onOpenSource ? { onOpenSource } : {})}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
