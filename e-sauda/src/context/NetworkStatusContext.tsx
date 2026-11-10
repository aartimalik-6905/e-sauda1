import { createContext, useContext, ReactNode } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

interface NetworkStatusValue {
  liteMode: boolean
  setLiteMode: (value: boolean) => void
}

const NetworkStatusContext = createContext<NetworkStatusValue | null>(null)

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const value = useNetworkStatus()
  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>
}

// Falls back to "not lite mode, no-op setter" if somehow used outside the
// provider, rather than throwing -- a missing image placeholder should never
// be the thing that crashes a page.
export function useNetworkStatusContext(): NetworkStatusValue {
  const ctx = useContext(NetworkStatusContext)
  return ctx ?? { liteMode: false, setLiteMode: () => {} }
}
