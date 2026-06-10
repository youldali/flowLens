import { GraphView } from './bounded-contexts/code-analysis-context/graph-visualization/components/GraphView'
import { RuntimeHostProvider } from './common/RuntimeHostProvider'

function App() {
  return (
    <RuntimeHostProvider>
      <GraphView />
    </RuntimeHostProvider>
  )
}

export default App
