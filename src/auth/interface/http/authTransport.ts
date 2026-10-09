import { randomUUID } from 'node:crypto'
import { headersWithCors, type PayloadRequest } from 'payload'
import { AuthFailure } from '../../contracts/errors'

const MAX_BODY_BYTES = 4096
export async function readJSON(req: PayloadRequest): Promise<unknown> {
  if (!req.headers.get('content-type')?.split(';')[0].trim().toLowerCase().endsWith('/json'))
    throw new AuthFailure('INVALID_INPUT', 400)
  const length = req.headers.get('content-length')
  if (length && Number(length) > MAX_BODY_BYTES) throw new AuthFailure('INVALID_INPUT', 400)
  if (!req.body) throw new AuthFailure('INVALID_INPUT', 400)
  const reader = req.body.getReader()
  let size = 0
  const parts: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new AuthFailure('INVALID_INPUT', 400)
      }
      parts.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const part of parts) {
      bytes.set(part, offset)
      offset += part.length
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch (error) {
    if (error instanceof AuthFailure) throw error
    throw new AuthFailure('INVALID_INPUT', 400)
  } finally {
    reader.releaseLock()
  }
}
export function authFailureResponse(
  error: unknown,
  req: PayloadRequest,
  requestId?: string,
): Response {
  const failure = error instanceof AuthFailure ? error : new AuthFailure('AUTH_FAILED', 401)
  const correlation = requestId ?? randomUUID()
  // Logger failures must not turn a safe denial into an uncaught transport failure.
  try {
    if (!requestId)
      req.payload.logger?.info({
        event:
          failure.code === 'AUTH_UNAVAILABLE' || !(error instanceof AuthFailure)
            ? 'auth.infrastructure.failed'
            : 'auth.request.rejected',
        correlation,
        code: failure.code,
      })
  } catch {
    /* Consumer logger availability does not grant access. */
  }
  return Response.json(
    { success: false, code: failure.code },
    {
      status: failure.status,
      headers: headersWithCors({ headers: new Headers({ 'X-Auth-Request-ID': correlation }), req }),
    },
  )
}
export function assertAllowedOrigin(req: PayloadRequest): void {
  const origin = req.headers.get('origin')
  // Match effective Payload CSRF semantics for browser requests; do not invent a global allowlist.
  if (origin && req.payload.config.csrf.length && !req.payload.config.csrf.includes(origin))
    throw new AuthFailure('ORIGIN_DENIED', 403)
}
