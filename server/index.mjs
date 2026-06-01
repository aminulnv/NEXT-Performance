import 'dotenv/config'
import app, { logStartupHints } from './app.mjs'

const port = Number(process.env.PORT || process.env.API_PORT) || 3001

logStartupHints()

const server = app.listen(port, () => {
  console.log(`Performance API listening on http://localhost:${port}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[api] Port ${port} is already in use. Stop the other process: lsof -ti :${port} | xargs kill -9`,
    )
    process.exit(1)
  }
  throw err
})
