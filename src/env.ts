/** Dev-only — production builds never bypass auth, even if VITE_BYPASS_AUTH is set on Vercel. */
const bypassAuth =
  import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'

export const env = {
  bypassAuth,
}
