/**
 * Writes vercel.json before deploy. When API_BACKEND_URL is set on Vercel,
 * /api/* is proxied to the Node backend (Render/Railway) so Google OAuth works
 * on the same origin as the static app.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const templatePath = path.join(root, 'vercel.template.json')
const outPath = path.join(root, 'vercel.json')

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'))
const backend = process.env.API_BACKEND_URL?.trim().replace(/\/$/, '')

const rewrites = []

if (backend) {
  rewrites.push({
    source: '/api/:path*',
    destination: `${backend}/api/:path*`,
  })
  console.log(`[vercel] API proxy → ${backend}/api/*`)
} else {
  console.warn(
    '[vercel] API_BACKEND_URL is not set — /api will not work (Google login will fail).',
  )
  console.warn('[vercel] See docs/DEPLOY_VERCEL.md')
}

rewrites.push({
  source: '/((?!api/).*)',
  destination: '/index.html',
})

const vercelConfig = {
  ...template,
  rewrites,
}

fs.writeFileSync(outPath, `${JSON.stringify(vercelConfig, null, 2)}\n`)
console.log('[vercel] Wrote vercel.json')
