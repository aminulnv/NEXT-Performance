import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { env } from '@/env'
import { fetchAuthMe, googleLoginUrl, logout as apiLogout, type AuthUser } from '@/lib/authApi'
import type { Role } from '@/lib/permissions'
import { canAccessPath, roleHasPage, canManageUsers } from '@/lib/permissions'
import { clearTourDismissed } from '@/lib/platformTour'
import { clearBrowserCache } from '@/lib/browserCache'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  displayName: string
  role: Role | null
  signInWithGoogle: (returnTo?: string) => void
  signOut: () => Promise<void>
  canAccessPath: (pathname: string) => boolean
  canAccessPage: (pageKey: string) => boolean
  /** True for administrators — show User management in nav and Home */
  canManageUsers: boolean
  canManageAccess: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEV_USER: AuthUser = {
  id: 'local',
  email: 'dashboard@local',
  name: 'Performance (dev)',
  picture: null,
  role: 'admin',
  employeeId: null,
  scopedDepartments: null,
  roleLabel: 'Administrator',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(env.bypassAuth ? DEV_USER : null)
  const [loading, setLoading] = useState(!env.bypassAuth)

  const refresh = useCallback(async () => {
    if (env.bypassAuth) {
      setUser(DEV_USER)
      setLoading(false)
      return
    }
    try {
      const data = await fetchAuthMe()
      setUser(data.authenticated ? data.user : null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signInWithGoogle = useCallback((returnTo?: string) => {
    window.location.href = googleLoginUrl(returnTo)
  }, [])

  const signOut = useCallback(async () => {
    if (env.bypassAuth) return
    clearTourDismissed()
    await clearBrowserCache()
    await apiLogout()
    setUser(null)
    window.location.href = '/login'
  }, [])

  const role = user?.role ?? null

  const value: AuthContextValue = {
    user,
    loading,
    displayName: user?.name || user?.email || '',
    role,
    signInWithGoogle,
    signOut,
    canAccessPath: (pathname) => {
      if (!role) return false
      if (env.bypassAuth) return true
      return canAccessPath(role, pathname)
    },
    canAccessPage: (pageKey) => {
      if (!role) return false
      if (env.bypassAuth) return true
      return roleHasPage(role, pageKey)
    },
    canManageUsers: env.bypassAuth || canManageUsers(role ?? ''),
    canManageAccess: env.bypassAuth || canManageUsers(role ?? ''),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx == null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
