import { QuerySuspense } from '../../../../../common/QuerySuspense'
import { useFetchGraph } from '../../apis/fetchGraph'
import { GraphViewContent } from './GraphViewContent'
import './GraphView.css'

export function GraphView() {
  const graphQuery = useFetchGraph()

  return (
    <main className="graph-view-container">
      <header className="graph-view-container__header">
        <h1>FlowLens Graph</h1>
        <p>React Flow view backed by the shared graph model.</p>
      </header>
      <QuerySuspense
        queryState={graphQuery}
        loading={<div className="graph-view-container__status">Loading graph...</div>}
        fallback={(error) => (
          <div className="graph-view-container__status graph-view-container__status--error">
            {error.message}
          </div>
        )}
      >
        {(graph) => <GraphViewContent graph={graph} />}
      </QuerySuspense>
    </main>
  )
}
