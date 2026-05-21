import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { routes } from '@/lib/routes'

type RoleProtectedRouteProps = {
  children: React.ReactNode
}

/** Requires login and page-level permission for the current URL. */
export default function RoleProtectedRoute({ children }: RoleProtectedRouteProps) {
  const { user, loading, canAccessPath } = useAuth()
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
    return (
      <div className="pd-page">
        <div className="pd-alert">
          You do not have permission to view this page. Your role: <strong>{user.roleLabel}</strong>
        </div>
        <p>
          <a href={routes.home}>Return to Home</a>
        </p>
      </div>
    )
  }

  return <>{children}</>
}
