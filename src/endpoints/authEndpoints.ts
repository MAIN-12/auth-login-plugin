import { generatePayloadCookie, headersWithCors, loginOperation, refreshOperation, type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig } from '../config'
import { AuthFailure, createPasswordLogin } from '../auth/domain/login'
import { readCredentialCapabilities } from '../auth/server/credentialEvidence'
import { credentialCapabilities } from '../auth/domain/credentials'

const MAX_BODY_BYTES = 4096
async function readJSON(req: PayloadRequest): Promise<unknown> {
  if (!req.headers.get('content-type')?.split(';')[0].trim().toLowerCase().endsWith('/json')) throw new AuthFailure('INVALID_INPUT', 400)
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
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new AuthFailure('INVALID_INPUT', 400) }
      parts.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const part of parts) { bytes.set(part, offset); offset += part.length }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch (error) {
    if (error instanceof AuthFailure) throw error
    throw new AuthFailure('INVALID_INPUT', 400)
  } finally { reader.releaseLock() }
}
export function authFailureResponse(error: unknown, req: PayloadRequest): Response {
  const failure = error instanceof AuthFailure ? error : new AuthFailure('AUTH_FAILED', 401)
  return Response.json({ success: false, code: failure.code }, { status: failure.status, headers: headersWithCors({ headers: new Headers(), req }) })
}
export function assertAllowedOrigin(req: PayloadRequest): void {
  const origin = req.headers.get('origin')
  // Match effective Payload CSRF semantics for browser requests; do not invent a global allowlist.
  if (origin && req.payload.config.csrf.length && !req.payload.config.csrf.includes(origin)) throw new AuthFailure('ORIGIN_DENIED', 403)
}

export function createPasswordLoginEndpoint(settings: PublicAuthConfig, path = `${settings.authEndpointPrefix}/login`): Endpoint {
  return { path, method: 'post', handler: async req => {
    try {
      assertAllowedOrigin(req)
      const input = await readJSON(req)
      const collection = req.payload.collections[settings.collection]
      const login = createPasswordLogin({ enabled: settings.passwordLogin, authenticate: credentials => loginOperation({ collection, data: credentials, req }) })
      const result = await login(input)
      if (!result.user || !result.token) throw new AuthFailure('AUTH_FAILED', 401)
      const tokenLifetime = Math.max(1, (result.exp ?? 0) - Math.floor(Date.now() / 1000))
      const cookie = generatePayloadCookie({ collectionAuthConfig: { ...collection.config.auth, tokenExpiration: tokenLifetime }, cookiePrefix: req.payload.config.cookiePrefix, token: result.token })
      return Response.json({ success: true, user: result.user, exp: result.exp, capabilities: credentialCapabilities({ passwordAuthenticated: true, verified: result.user._verified }),
        ...(!collection.config.auth.removeTokenFromResponses ? { token: result.token } : {}),
      }, { headers: headersWithCors({ headers: new Headers({ 'Set-Cookie': cookie }), req }) })
    } catch (error) { return authFailureResponse(error, req) }
  } }
}
export function createAuthEndpoints(settings: PublicAuthConfig): Endpoint[] {
  const disabled: Endpoint['handler'] = req => authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
  return [createPasswordLoginEndpoint(settings),
    { path: `${settings.authEndpointPrefix}/check-email`, method: 'post', handler: disabled },
    { path: `${settings.authEndpointPrefix}/credentials`, method: 'get', handler: async req => {
      if (!req.user || req.user.collection !== settings.collection) return authFailureResponse(new AuthFailure('UNAUTHENTICATED', 401), req)
      try { return Response.json({ capabilities: await readCredentialCapabilities(req, settings.collection) }) }
      catch { return authFailureResponse(new AuthFailure('AUTH_UNAVAILABLE', 503), req) }
    } },
    ...['otp/send', 'otp/verify', 'signup', 'set-password', 'forgot-password', 'reset-password', 'oauth/google', 'oauth/google/callback'].map(path => ({ path: `${settings.authEndpointPrefix}/${path}`, method: 'post' as const, handler: disabled })),
  ]
}

export function createRefreshEndpoint(settings: PublicAuthConfig): Endpoint {
  return { path: '/refresh-token', method: 'post', handler: async req => {
    try {
      assertAllowedOrigin(req)
      const collection = req.payload.collections[settings.collection]
      const result = await refreshOperation({ collection, req })
      const headers = new Headers()
      if (result.setCookie) {
        const tokenLifetime = Math.max(1, result.exp - Math.floor(Date.now() / 1000))
        headers.set('Set-Cookie', generatePayloadCookie({ collectionAuthConfig: { ...collection.config.auth, tokenExpiration: tokenLifetime }, cookiePrefix: req.payload.config.cookiePrefix, token: result.refreshedToken }))
      }
      return Response.json({ success: true, user: result.user, exp: result.exp,
        ...(!collection.config.auth.removeTokenFromResponses ? { refreshedToken: result.refreshedToken } : {}),
      }, { headers: headersWithCors({ headers, req }) })
    } catch (error) { return authFailureResponse(error, req) }
  } }
}
