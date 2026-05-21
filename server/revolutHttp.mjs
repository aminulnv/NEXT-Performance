const BASE = 'https://revolutpeople.com/api/next/external/services/v1'

const PAGE_DELAY_MS = Number(process.env.REVOLUT_PAGE_DELAY_MS) || 350
const MAX_ATTEMPTS = Number(process.env.REVOLUT_MAX_RETRIES) || 6

let lastRequestAt = 0

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle() {
  const wait = lastRequestAt + PAGE_DELAY_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

export async function revolutRequest(token, path, query = {}, attempt = 1) {
  await throttle()

  const url = new URL(`${BASE}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        APITOKEN: token,
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${path}`)
      err.statusCode = res.status
      throw err
    }

    return res.json()
  } catch (err) {
    const status = err.statusCode ?? 0
    if (attempt < MAX_ATTEMPTS && [502, 503, 504, 429].includes(status)) {
      const backoff = status === 429 ? 4000 * attempt : 2000 * attempt
      await sleep(backoff)
      return revolutRequest(token, path, query, attempt + 1)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function revolutLogin(email, apiToken) {
  await throttle()
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({ email, token: apiToken }),
  })

  if (!res.ok) {
    throw new Error(`Revolut login failed: HTTP ${res.status}`)
  }

  const data = await res.json()
  if (!data.token) throw new Error('Revolut login response missing token')
  return data.token
}
