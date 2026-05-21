import { useAuth } from '@/contexts/AuthContext'
import { getPermissionsConfig } from '@/lib/permissions'

export default function ProfilePage() {
  const { user, displayName } = useAuth()
  const config = getPermissionsConfig()
  const rolePages = user?.role ? config.roles[user.role]?.pages : []

  return (
    <div className="pd-page" style={{ maxWidth: '36rem' }}>
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Profile</h1>
          <p className="pd-page-subtitle">Your account</p>
        </div>
      </header>
      <div className="pd-panel">
        <dl className="pd-dl">
          <dt>Name</dt>
          <dd>{displayName || '—'}</dd>
          <dt>Email</dt>
          <dd>{user?.email || '—'}</dd>
          <dt>Role</dt>
          <dd>{user?.roleLabel ?? user?.role ?? '—'}</dd>
          <dt>Employee ID</dt>
          <dd>{user?.employeeId || '—'}</dd>
        </dl>
      </div>
      {rolePages && rolePages.length > 0 ? (
        <div className="pd-panel">
          <h2 className="pd-panel-title">Pages you can access</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
            {(rolePages.includes('*')
              ? Object.values(config.pages).map((p) => p.label)
              : rolePages.map((key) => config.pages[key]?.label ?? key)
            ).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
