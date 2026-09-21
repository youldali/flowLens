import { useState, type PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { createAppStore } from '@store'

export function AppShell({ children }: PropsWithChildren) {
  const [store] = useState(createAppStore)

  return <Provider store={store}>{children}</Provider>
}
