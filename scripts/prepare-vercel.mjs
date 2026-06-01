/**
 * Writes vercel.json before deploy. API routes run as Vercel serverless functions
 * (api/index.mjs → Express app). No external backend proxy.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const templatePath = path.join(root, 'vercel.template.json')
const outPath = path.join(root, 'vercel.json')

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'))

fs.writeFileSync(outPath, `${JSON.stringify(template, null, 2)}\n`)
console.log('[vercel] Wrote vercel.json — API served by Vercel Functions + Supabase storage')
