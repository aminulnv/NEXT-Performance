const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true'

export const env = {
  bypassAuth,
}
