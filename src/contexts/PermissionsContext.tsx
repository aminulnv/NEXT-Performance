import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { env } from '@/env'
import { useAuth } from '@/contexts/AuthContext'
import { fetchPermissions } from '@/lib/permissionsApi'
import {
  setActivePermissionsConfig,
  getPermissionsConfig,
  type PermissionsConfig,
} from '@/lib/permissions'
import permissionsJson from '@/config/permissions.json'

type PermissionsContextValue = {
  ready: boolean
  source: 'supabase' | 'file' | 'bundled' | null
  refresh: () => Promise<void>
  getConfig: () => PermissionsConfig
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

const bundledConfig = permissionsJson as PermissionsConfig

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [ready, setReady] = useState(env.bypassAuth)
  const [source, setSource] = useState<PermissionsContextValue['source']>(
    env.bypassAuth ? 'bundled' : null,
  )

  const refresh = useCallback(async () => {
    if (env.bypassAuth) {
      setActivePermissionsConfig(bundledConfig)
      setSource('bundled')
      setReady(true)
      return
    }

    if (authLoading) return

    if (!user) {
      setActivePermissionsConfig(bundledConfig)
      setSource('bundled')
      setReady(true)
      return
    }

    try {
      const data = await fetchPermissions()
      const { source: storageSource, ...config } = data
      setActivePermissionsConfig(config)
      setSource(storageSource === 'supabase' || storageSource === 'file' ? storageSource : 'bundled')
    } catch {
      setActivePermissionsConfig(bundledConfig)
      setSource('bundled')
    } finally {
      setReady(true)
    }
  }, [user, authLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value: PermissionsContextValue = {
    ready,
    source,
    refresh,
    getConfig: getPermissionsConfig,
  }

  if (!ready) {
    return (
      <div className="pd-page" style={{ padding: '2rem' }}>
        <p className="pd-page-subtitle">Loading access rules…</p>
      </div>
    )
  }

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (ctx == null) {
    throw new Error('usePermissions must be used within PermissionsProvider')
  }
  return ctx
}
