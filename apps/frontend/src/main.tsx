import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Provider } from 'react-redux'
import { ConfigProvider, getConfig } from './common/config'
import { initializeI18n } from './common/i18n'
import { store } from './store'
import 'reactflow/dist/style.css'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()
const config = getConfig()

await initializeI18n(config)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider config={config}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </Provider>
    </ConfigProvider>
  </StrictMode>,
)
