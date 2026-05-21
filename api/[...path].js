/**
 * Vercel serverless proxy: forwards /api/* to Render (API_BACKEND_URL).
 * Set API_BACKEND_URL=https://next-performance.onrender.com on Vercel.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
])

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  const backend = process.env.API_BACKEND_URL?.trim().replace(/\/$/, '')
  if (!backend) {
    res.status(503).json({
      error:
        'API_BACKEND_URL is not set on Vercel. Set it to https://next-performance.onrender.com and redeploy.',
    })
    return
  }

  const targetUrl = `${backend}${req.url || ''}`
  const headers = {}

  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    if (value === undefined) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }

  const publicHost = req.headers['x-forwarded-host'] || req.headers.host
  if (publicHost) {
    headers['x-forwarded-host'] = publicHost
    headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'https'
  }

  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const raw = await readBody(req)
    if (raw.length > 0) body = raw
  }

  let upstream
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    })
  } catch (err) {
    console.error('[api proxy]', targetUrl, err)
    res.status(502).json({
      error: 'API backend unreachable. Check API_BACKEND_URL and that Render is running.',
    })
    return
  }

  res.status(upstream.status)
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    res.setHeader(key, value)
  })

  const buf = Buffer.from(await upstream.arrayBuffer())
  res.send(buf)
}

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
}
