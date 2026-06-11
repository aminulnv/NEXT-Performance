import { clientIp } from './auditLog.mjs'
import { isProductionRuntime } from './security.mjs'

export class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} publicMessage Safe message for API clients
   * @param {{ expose?: boolean, details?: unknown }} [options]
   */
  constructor(statusCode, publicMessage, options = {}) {
    super(publicMessage)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.publicMessage = publicMessage
    this.expose = options.expose ?? statusCode < 500
    this.details = options.details
  }
}

export function isHttpError(err) {
  return err instanceof HttpError
}

export function statusCodeFor(err) {
  if (isHttpError(err)) return err.statusCode
  const code = err?.statusCode
  if (typeof code === 'number' && code >= 400 && code < 600) return code
  return 500
}

export function clientErrorMessage(err, env = process.env) {
  if (isHttpError(err)) return err.publicMessage
  if (!isProductionRuntime(env) && err instanceof Error) return err.message
  return 'An unexpected error occurred'
}

export function logServerError(req, err) {
  const payload = {
    path: req.originalUrl ?? req.url,
    method: req.method,
    actor: req.user?.email ?? req.session?.user?.email ?? null,
    role: req.user?.role ?? null,
    ip: clientIp(req),
    error: err instanceof Error ? err.message : String(err),
    name: err instanceof Error ? err.name : 'Error',
  }
  if (isHttpError(err) && err.details != null) {
    payload.details = err.details
  }
  console.error('[api]', JSON.stringify(payload))
  if (!isProductionRuntime() && err instanceof Error && err.stack) {
    console.error(err.stack)
  }
}

export function errorResponseBody(err, env = process.env) {
  const body = { error: clientErrorMessage(err, env) }
  if (isHttpError(err) && err.expose && err.details !== undefined) {
    body.details = err.details
  }
  return body
}

/** Express error middleware — log details server-side, return safe JSON to clients. */
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return

  logServerError(req, err)
  const status = statusCodeFor(err)
  res.status(status).json(errorResponseBody(err))
}

/** Wrap async route handlers so rejections reach the error middleware. */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

/** Map unknown errors to HttpError for throwing from route handlers. */
export function toHttpError(err, fallbackMessage, statusCode = 500) {
  if (isHttpError(err)) return err
  return new HttpError(statusCode, fallbackMessage)
}
