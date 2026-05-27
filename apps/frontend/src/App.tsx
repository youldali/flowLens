import type { Graph } from '@flowlens/graph-model'
import { GraphView } from './bounded-contexts/code-analysis-context/graph-visualization/components/GraphView'
import './App.css'

const sampleGraph: Graph = {
  nodes: new Map([
    [
      'file:src/main.ts',
      {
        id: 'file:src/main.ts',
        kind: 'file',
        name: 'src/main.ts',
        filePath: 'src/main.ts',
      },
    ],
    [
      'function:createApp',
      {
        id: 'function:createApp',
        kind: 'functionDeclaration',
        name: 'createApp',
        filePath: 'src/main.ts',
      },
    ],
    [
      'call:render',
      {
        id: 'call:render',
        kind: 'callExpression',
        name: 'render',
        filePath: 'src/main.ts',
      },
    ],
  ]),
  edges: new Map([
    [
      'file:src/main.ts->function:createApp:declares',
      {
        id: 'file:src/main.ts->function:createApp:declares',
        source: 'file:src/main.ts',
        target: 'function:createApp',
        type: 'declares',
      },
    ],
    [
      'function:createApp->call:render:calls',
      {
        id: 'function:createApp->call:render:calls',
        source: 'function:createApp',
        target: 'call:render',
        type: 'calls',
      },
    ],
  ]),
}

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>FlowLens Graph</h1>
        <p>React Flow view backed by the shared graph model.</p>
      </header>
      <GraphView graph={sampleGraph} />
    </main>
  )
}

export default App
