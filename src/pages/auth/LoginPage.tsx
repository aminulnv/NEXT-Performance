import { useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { assets, getBackgroundStyle } from '@/config/assets'
import '@/styles/performance.css'

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: 'Google sign-in was cancelled or incomplete.',
  no_id_token: 'Google did not return a valid token.',
  no_email: 'Your Google account has no email address.',
  domain_not_allowed: 'Your email domain is not allowed for this app.',
  no_access:
    'You are not on the access list. Ask an administrator to add your email under Admin → User management.',
  auth_failed: 'Sign-in failed. Try again or contact support.',
}

export default function LoginPage() {
  const { signInWithGoogle, loading, user } = useAuth()
  const [params] = useSearchParams()
  const errorCode = params.get('error')
  const returnTo = params.get('returnTo') || '/'

  const errorMessage = useMemo(() => {
    if (!errorCode) return null
    return ERROR_MESSAGES[errorCode] ?? 'Sign-in failed.'
  }, [errorCode])

  if (!loading && user) {
    return (
      <div className="pd-login-wrap">
        <p>
          Already signed in as {user.email}. <Link to="/">Go to dashboard</Link>
        </p>
      </div>
    )
  }

  return (
    <div
      className="pd-login-wrap"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...getBackgroundStyle(assets.loginBackgroundValue),
      }}
    >
      <div className="pd-login-card">
        {assets.logoUrl ? (
          <img src={assets.logoUrl} alt="" className="pd-login-logo" width={64} height={64} />
        ) : null}
        <h1 className="pd-login-title">{assets.appTitle}</h1>
        <p className="pd-login-subtitle">Sign in with your company Google account</p>

        {errorMessage ? <div className="pd-alert">{errorMessage}</div> : null}

        <button
          type="button"
          className="pd-btn pd-login-google-btn"
          disabled={loading}
          onClick={() => signInWithGoogle(returnTo)}
        >
          Continue with Google
        </button>

        <p className="pd-login-footnote">
          Access is granted by your administrator. New users must be added before first login.
        </p>
      </div>
    </div>
  )
}
