import { readCutoverGeneration } from '../auth/server/cutoverGeneration'
import { randomBytes, randomUUID } from 'node:crypto'
import { generatePayloadCookie, headersWithCors, loginOperation, refreshOperation, type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../config'
import { AuthFailure, createPasswordLogin } from '../auth/domain/login'
import { readCredentialCapabilities } from '../auth/server/credentialEvidence'
import { credentialCapabilities } from '../auth/domain/credentials'

import { decodeProofBinding, encodeProofBinding, proofQuotaIdentity } from '../auth/domain/proofBinding'
import { otpSendSchema, otpVerifySchema, parseAuthInterface } from './authSchemas'
import { createOtpFlow } from '../auth/domain/otp'
import { createPayloadOtpStore } from '../auth/server/otpStore'
import { credentialVersion } from '../auth/server/credentialRequest'
import { createOtpSession } from '../auth/server/otpSession'
import { createPasswordEndpoints, createOwnershipOtpEndpoint } from './passwordEndpoints'
import { otpEmail } from '../auth/server/otpEmail'

const MAX_BODY_BYTES = 4096
export async function readJSON(req: PayloadRequest): Promise<unknown> {
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
export function authFailureResponse(error: unknown, req: PayloadRequest, requestId?: string): Response {
  const failure = error instanceof AuthFailure ? error : new AuthFailure('AUTH_FAILED', 401)
  const correlation = requestId ?? randomUUID()
  // Logger failures must not turn a safe denial into an uncaught transport failure.
  try { if (!requestId) req.payload.logger?.info({ event: failure.code === 'AUTH_UNAVAILABLE' || !(error instanceof AuthFailure) ? 'auth.infrastructure.failed' : 'auth.request.rejected', correlation, code: failure.code }) } catch { /* Consumer logger availability does not grant access. */ }
  return Response.json({ success: false, code: failure.code }, { status: failure.status, headers: headersWithCors({ headers: new Headers({ 'X-Auth-Request-ID': correlation }), req }) })
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
    } catch (error) {
      const response = authFailureResponse(error, req)
      try { req.payload.logger?.info({ event: 'auth.login.rejected', correlation: response.headers.get('X-Auth-Request-ID') }) } catch { /* Fail closed even with an unavailable consumer logger. */ }
      return response
    }
  } }
}
export function createAuthEndpoints(settings: PublicAuthConfig, otpOptions?: OtpOptions, assertPublicAccount?: (req: PayloadRequest) => Promise<void>): Endpoint[] {
  const disabled: Endpoint['handler'] = req => authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
  return [createPasswordLoginEndpoint(settings), ...createOtpEndpoints(settings, otpOptions, assertPublicAccount), ...createPasswordEndpoints(settings, otpOptions, assertPublicAccount),
    { path: `${settings.authEndpointPrefix}/check-email`, method: 'post', handler: disabled },
    { path: `${settings.authEndpointPrefix}/credentials`, method: 'get', handler: async req => {
      if (!req.user || req.user.collection !== settings.collection) return authFailureResponse(new AuthFailure('UNAUTHENTICATED', 401), req)
      try { return Response.json({ capabilities: await readCredentialCapabilities(req, settings.collection) }) }
      catch { return authFailureResponse(new AuthFailure('AUTH_UNAVAILABLE', 503), req) }
    } },
    ...['oauth/google', 'oauth/google/callback'].map(path => ({ path: `${settings.authEndpointPrefix}/${path}`, method: 'post' as const, handler: disabled })),
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

function createOtpEndpoints(settings: PublicAuthConfig, options?: OtpOptions, assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>): Endpoint[] {
  return ['send', 'verify'].map(action => ({ path: `${settings.authEndpointPrefix}/otp/${action}`, method: 'post', handler: async req => {
    if (!options) return authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
    let purpose: { input: unknown; purpose: unknown }
    try { const input = parseAuthInterface(action === 'send' ? otpSendSchema : otpVerifySchema, await readJSON(req)); purpose = { input, purpose: input.purpose } } catch (error) { return authFailureResponse(error, req) }
    if (purpose.input && purpose.purpose !== 'login') return createOwnershipOtpEndpoint(settings, options, action, purpose.input, assertOriginalAdminDenied).handler(req)
    if (!settings.otpLogin || !options) return authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
    try {
      assertAllowedOrigin(req)
      const input = purpose.input
      let challengeGeneration: string
      try { challengeGeneration = await readCutoverGeneration(req, settings.collection) }
      catch (error) {
        try { req.payload.logger.info({ event: 'auth.otp.unavailable', correlation: randomBytes(32).toString('hex') }) } catch { /* Logging cannot change the fail-closed response. */ }
        throw error
      }
      const flow = createOtpFlow({ ...options, collection: settings.collection, challengeGeneration, store: createPayloadOtpStore(req),
        findAccount: async email => {
          const account = await req.payload.db.findOne({ collection: settings.collection, req, where: { email: { equals: email } } })
          return account ? encodeProofBinding({ accountID: account.id, version: credentialVersion(req.payload.secret, account) }) : null
        },
        quotaIdentity: proofQuotaIdentity,
        session: (account, email) => { const binding = decodeProofBinding(account); if (binding.accountID === null) throw new AuthFailure('AUTH_FAILED', 401); return createOtpSession(req, binding.accountID, settings.collection, email, binding.version, { method: 'otp' }, assertOriginalAdminDenied) },
        deliver: async ({ email, code }) => {
          const mail = otpEmail(code, requestEmailSettings(req, options))
          await req.payload.sendEmail({ to: email, ...(options.email ? { from: options.email.from } : {}), ...mail })
        },
        event: (event, correlation) => req.payload.logger.info({ event: `auth.otp.${event}`, correlation }),
      })
      if (action === 'send') {
        let origin: string | null
        try { origin = await options.origin(req) } catch { origin = null }
        return Response.json(await flow.send(input, origin), { headers: headersWithCors({ headers: new Headers(), req }) })
      }
      const result = await flow.verify(input)
      const collection = req.payload.collections[settings.collection]
      const cookie = generatePayloadCookie({ collectionAuthConfig: { ...collection.config.auth, tokenExpiration: Math.max(1, result.exp - Math.floor(Date.now() / 1000)) }, cookiePrefix: req.payload.config.cookiePrefix, token: result.token })
      return Response.json({ success: true, user: result.user, exp: result.exp, ...(!collection.config.auth.removeTokenFromResponses ? { token: result.token } : {}) }, { headers: headersWithCors({ headers: new Headers({ 'Set-Cookie': cookie }), req }) })
    } catch (error) { return authFailureResponse(error, req) }
  } }))
}

/** Browser locale is explicit; unsupported values use the configured per-instance fallback. */
export function requestEmailSettings(req: PayloadRequest, options: OtpOptions) {
  const locale = req.headers.get('accept-language')
  return { ...options.email!, locale: locale === 'es' || locale === 'en' ? locale : options.email!.locale }
}
