import { useEffect, useState } from 'react'
import type { Graph } from '@flowlens/graph-model'
import { fetchGraph } from './bounded-contexts/code-analysis-context/graph-visualization/apis/fetchGraph'
import { GraphView } from './bounded-contexts/code-analysis-context/graph-visualization/components/GraphView'
import './App.css'

type GraphLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; graph: Graph }
  | { status: 'error'; message: string }

function App() {
  const [graphLoadState, setGraphLoadState] = useState<GraphLoadState>({ status: 'loading' })

  useEffect(() => {
    let isMounted = true

    fetchGraph()
      .then((graph) => {
        if (isMounted) {
          setGraphLoadState({ status: 'loaded', graph })
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setGraphLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load graph',
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>FlowLens Graph</h1>
        <p>React Flow view backed by the shared graph model.</p>
      </header>
      {renderGraphContent(graphLoadState)}
    </main>
  )
}

function renderGraphContent(graphLoadState: GraphLoadState) {
  if (graphLoadState.status === 'loading') {
    return <div className="app-status">Loading graph...</div>
  }

  if (graphLoadState.status === 'error') {
    return <div className="app-status app-status--error">{graphLoadState.message}</div>
  }

  return <GraphView graph={graphLoadState.graph} />
}

export default App
