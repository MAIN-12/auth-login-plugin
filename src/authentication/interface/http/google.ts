import { randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  APIError,
  generatePayloadCookie,
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import { parseCookies } from 'payload/shared'
import type { PublicAuthConfig } from '../../../configuration/plugin/config'
import type { createGoogleScope } from '../../wiring/google'
import { AuthFailure, authStatus } from '../../../shared/contracts/errors'
import { AuthOperationFailure, safeAuthErrorReason } from '../../../shared/domain/errors'
import { parseAuthInterface } from './authSchemas'
import {
  assertAllowedOrigin,
  authFailureResponse,
  readJSON,
} from '../../../shared/interface/http/authTransport'
function mapFailure(error: unknown) {
  const mapped =
    error instanceof AuthOperationFailure
      ? new AuthFailure(error.code, authStatus[error.code], error.reason)
      : error instanceof AuthFailure
        ? error
        : error instanceof APIError && [400, 401, 403].includes(error.status)
          ? new AuthFailure('AUTH_FAILED', 401, 'AUTHENTICATION_REJECTED')
          : new AuthFailure('AUTH_UNAVAILABLE', 503, 'AUTHENTICATION_UNAVAILABLE')
  return new AuthFailure(
    mapped.code,
    mapped.status,
    safeAuthErrorReason(mapped.reason) ??
      (mapped.code === 'AUTH_UNAVAILABLE'
        ? 'AUTHENTICATION_UNAVAILABLE'
        : mapped.code === 'AUTH_FAILED'
          ? 'AUTHENTICATION_REJECTED'
          : undefined),
  )
}
function failure(error: unknown, req: PayloadRequest, requestId?: string) {
  const response = authFailureResponse(mapFailure(error), req, requestId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
const startSchema = z.object({ returnTo: z.string().max(2048).optional() }).strict()
const popupSchema = startSchema.extend({ mode: z.literal('popup').optional() }).strict()
const linkSchema = startSchema.extend({
  permit: z.string().min(1).max(2048),
  confirm: z.literal(true),
})
function popupResponse(payload: unknown, origin: string, headers: Headers) {
  const nonce = randomBytes(16).toString('base64url')
  const message = JSON.stringify(payload).replaceAll('<', '\\u003c')
  const target = JSON.stringify(origin).replaceAll('<', '\\u003c')
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
  )
  return new Response(
    `<!doctype html><title>Authentication complete</title><script nonce="${nonce}">window.opener?.postMessage(${message},${target});window.close()</script>`,
    { headers },
  )
}
/** HTTP interface only: validated input, browser cookie, application call, native cookie/redirect. */
export function googleEndpoints(
  settings: PublicAuthConfig,
  redirectURI: string | undefined,
  enabled: boolean,
  flow: (req: PayloadRequest) => ReturnType<typeof createGoogleScope>,
): Endpoint[] {
  const path = `${settings.authEndpointPrefix}/oauth/google`
  const cookieName = (state: string) => `${settings.collection}-oauth-${state}`
  const cookie = (state: string, value: string, expire = false) =>
    `${cookieName(state)}=${value}; Path=${new URL(redirectURI!).pathname}; HttpOnly; SameSite=Lax; Max-Age=${expire ? 0 : 600}${new URL(redirectURI!).protocol === 'https:' ? '; Secure' : ''}`
  const start = (purpose: 'login' | 'link' | 'reauth'): Endpoint => ({
    path:
      purpose === 'login' ? path : `${path}/${purpose === 'reauth' ? 'reauthenticate' : purpose}`,
    method: purpose === 'link' ? 'post' : 'get',
    handler: async (req) => {
      const scope = flow(req)
      try {
        if (!settings.googleOAuthEnabled || !enabled) throw new AuthFailure('METHOD_DISABLED', 403)
        assertAllowedOrigin(req)
        const url = new URL(req.url!)
        const input =
          purpose === 'link'
            ? parseAuthInterface(linkSchema, await readJSON(req))
            : parseAuthInterface(popupSchema, Object.fromEntries(url.searchParams))
        const browser = randomBytes(32).toString('base64url')
        const result = await scope.start({
          browser,
          returnTo: input.returnTo,
          purpose,
          popup: 'mode' in input && input.mode === 'popup',
          ...('permit' in input && typeof input.permit === 'string'
            ? { permit: input.permit }
            : {}),
        })
        if (purpose === 'link')
          return Response.json(
            { url: result.url },
            {
              headers: headersWithCors({
                headers: new Headers({
                  'Set-Cookie': cookie(result.state, browser),
                  'Cache-Control': 'no-store',
                }),
                req,
              }),
            },
          )
        return new Response(null, {
          status: 303,
          headers: headersWithCors({
            headers: new Headers({
              Location: result.url,
              'Set-Cookie': cookie(result.state, browser),
              'Cache-Control': 'no-store',
              'Referrer-Policy': 'no-referrer',
            }),
            req,
          }),
        })
      } catch (error) {
        return failure(error, req)
      } finally {
        scope.dispose()
      }
    },
  })
  return [
    start('login'),
    start('link'),
    start('reauth'),
    {
      path: `${path}/callback`,
      method: 'get',
      handler: async (req) => {
        const requestId = randomUUID()
        let state = ''
        const scope = flow(req)
        try {
          if (!settings.googleOAuthEnabled || !enabled)
            throw new AuthFailure('METHOD_DISABLED', 403)
          const url = new URL(req.url!)
          const expected = new URL(redirectURI!)
          // Next's native Request URL may use an internal localhost origin. Never trust
          // forwarding headers: require the exact public Host and configured callback path.
          if (req.headers.get('host') !== expected.host || url.pathname !== expected.pathname)
            throw new AuthFailure('AUTH_FAILED', 401, 'OAUTH_CALLBACK_INVALID')
          const callbackURL = new URL(url.pathname + url.search, expected.origin)
          state = url.searchParams.get('state') ?? ''
          const result = await scope.callback(
            state,
            parseCookies(req.headers).get(cookieName(state)) ?? '',
            callbackURL.href,
          )
          const headers = headersWithCors({
            headers: new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }),
            req,
          })
          headers.append('Set-Cookie', cookie(state, '', true))
          if (result.purpose === 'login') {
            const receipt = scope.takeReceipt()
            const collection = req.payload.collections[settings.collection]
            headers.append(
              'Set-Cookie',
              generatePayloadCookie({
                collectionAuthConfig: {
                  ...collection.config.auth,
                  tokenExpiration: Math.max(1, receipt.exp! - Math.floor(Date.now() / 1000)),
                },
                cookiePrefix: req.payload.config.cookiePrefix,
                token: receipt.token,
              }),
            )
            if (result.popup)
              return popupResponse(
                { type: 'auth-login.google.login', success: true },
                expected.origin,
                headers,
              )
          }
          if ('permit' in result.result) {
            if (!result.popup) return Response.json(result.result, { headers })
            return popupResponse(
              {
                type: 'auth-login.google.reauthentication',
                grant: result.result,
              },
              expected.origin,
              headers,
            )
          }
          headers.set('Location', result.returnTo)
          return new Response(null, { status: 303, headers })
        } catch (error) {
          try {
            const mapped = mapFailure(error)
            req.payload.logger.info({
              event: 'auth_login_google_callback_rejected',
              requestId,
              code: mapped.code,
              reason: mapped.reason,
            })
          } catch {
            /* Logging cannot interrupt safe rejection or correlation-cookie cleanup. */
          }
          const response = failure(error, req, requestId)
          response.headers.set('X-Auth-Request-ID', requestId)
          if (enabled && /^[A-Za-z0-9_-]{43}$/.test(state))
            response.headers.append('Set-Cookie', cookie(state, '', true))
          return response
        } finally {
          scope.dispose()
        }
      },
    },
  ]
}
