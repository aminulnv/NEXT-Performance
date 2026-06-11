import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { redirectPathForUnauthorized } from '@/lib/permissions'

type RoleProtectedRouteProps = {
  children: React.ReactNode
}

/** Requires login and page-level permission for the current URL. */
export default function RoleProtectedRoute({ children }: RoleProtectedRouteProps) {
  const { user, loading, canAccessPath, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="pd-page" style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  if (!canAccessPath(location.pathname)) {
    const fallback = role ? redirectPathForUnauthorized(role, location.pathname) : null
    if (fallback && fallback !== location.pathname) {
      return <Navigate to={`${fallback}${location.search}`} replace />
    }

    return (
      <div className="pd-page">
        <div className="pd-alert">
          You do not have permission to view this page. Your role:{' '}
          <strong>{user.roleLabel}</strong>
        </div>
        {fallback ? (
          <p>
            <a href={fallback}>Go to your dashboard</a>
          </p>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}
