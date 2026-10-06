import { generatePayloadCookie, headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../config'
import { AuthFailure } from '../auth/domain/login'
import { createPasswordLifecycle } from '../auth/domain/passwordLifecycle'
import { createOwnershipVerification } from '../auth/application/ownershipVerification'
import { ownershipSendSchema, ownershipVerifySchema, forgotPasswordSchema, reauthenticationSchema, passwordCompletionSchema, parseAuthInterface } from './authSchemas'
import { commitPassword, passwordReauthentication } from '../auth/server/passwordAdapter'
import { credentialVersion } from '../auth/server/credentialRequest'
import { createPayloadOtpStore } from '../auth/server/otpStore'
import { otpEmail } from '../auth/server/otpEmail'
import { assertAllowedOrigin, authFailureResponse, readJSON } from './authEndpoints'

function lifecycle(req: PayloadRequest, settings: PublicAuthConfig, options?: OtpOptions) {
  return createPasswordLifecycle({ collection: settings.collection, secret: req.payload.secret, now: options?.now, signup: settings.allowSignup, recovery: settings.recovery, password: settings.passwordLogin,
    commit: (permit, password) => commitPassword(req, settings.collection, permit, password, options?.now),
  })
}
export function createOwnershipOtpEndpoint(settings: PublicAuthConfig, options: OtpOptions | undefined, action: string, parsed?: unknown): Endpoint {
  return { path: `${settings.authEndpointPrefix}/otp/${action}`, method: 'post', handler: async req => {
    try {
      assertAllowedOrigin(req)
      const input = parseAuthInterface(action === 'send' ? ownershipSendSchema : ownershipVerifySchema, parsed ?? await readJSON(req))
      const { purpose } = input
      if (!options || !settings.passwordLogin || (purpose === 'signup' && !settings.allowSignup) || (purpose === 'recovery' && !settings.recovery) || (purpose === 'reauth' && !settings.otpLogin)) throw new AuthFailure('METHOD_DISABLED', 403)
      if (purpose === 'reauth' && (!req.user || req.user.collection !== settings.collection || !req.user._sid)) throw new AuthFailure('UNAUTHENTICATED', 401)
      const flow = createOwnershipVerification({ ...options, collection: settings.collection, purpose, store: createPayloadOtpStore(req),
        principal: req.user?.collection === settings.collection ? { id: req.user.id, sid: req.user._sid ? String(req.user._sid) : undefined } : null,
        findOwnershipAccount: async email => {
          const account = await req.payload.db.findOne<NonNullable<PayloadRequest['user']>>({ collection: settings.collection, req, where: { email: { equals: email } } })
          return account ? { id: account.id, email: String(account.email), hash: account.hash, salt: account.salt, verified: account._verified, deleted: account.deletedAt } : null
        },
        credentialVersion: account => credentialVersion(req.payload.secret, { id: account.id, email: account.email, hash: account.hash, salt: account.salt, _verified: account.verified }),
        grant: async permit => lifecycle(req, settings, options).grant(permit),
        deliver: async ({ email, code }) => { await req.payload.sendEmail({ to: email, from: options.email!.from, ...otpEmail(code, options.email) }) },
        event: (event, correlation) => req.payload.logger.info({ event: `auth.${purpose}.${event}`, correlation }),
      })
      const result = action === 'send' ? await flow.send(input, await options.origin(req)) : await flow.verify(input)
      return Response.json(result, { headers: headersWithCors({ headers: new Headers({ 'Cache-Control': 'no-store' }), req }) })
    } catch (error) { return authFailureResponse(error, req) }
  } }
}
export function createPasswordEndpoints(settings: PublicAuthConfig, options?: OtpOptions): Endpoint[] {
  const endpoints = (['signup', 'reset-password', 'set-password'] as const).map(path => ({ path: `${settings.authEndpointPrefix}/${path}`, method: 'post' as const, handler: async (req: PayloadRequest) => {
    try {
      assertAllowedOrigin(req)
      if (!settings.passwordLogin || (path === 'signup' && !settings.allowSignup) || (path === 'reset-password' && !settings.recovery) || (path === 'set-password' && (!req.user || req.user.collection !== settings.collection))) throw new AuthFailure('METHOD_DISABLED', 403)
      const input = parseAuthInterface(passwordCompletionSchema, await readJSON(req))
      const result = await lifecycle(req, settings, options).complete(path === 'signup' ? 'signup' : path === 'reset-password' ? 'recovery' : 'reauth', input)
      const headers = new Headers({ 'Cache-Control': 'no-store' })
      const collection = req.payload.collections[settings.collection]
      if (result.token) headers.set('Set-Cookie', generatePayloadCookie({ collectionAuthConfig: { ...collection.config.auth, tokenExpiration: Math.max(1, result.exp! - Math.floor(Date.now() / 1000)) }, cookiePrefix: req.payload.config.cookiePrefix, token: result.token }))
      return Response.json({ success: true, ...(result.exp ? { exp: result.exp } : {}), ...(!collection.config.auth.removeTokenFromResponses && result.token ? { token: result.token } : {}) }, { headers: headersWithCors({ headers, req }) })
    } catch (error) { return authFailureResponse(error, req) }
  } }))
  return [...endpoints, { path: `${settings.authEndpointPrefix}/forgot-password`, method: 'post', handler: async req => {
    try {
      if (!settings.recovery || !settings.passwordLogin) throw new AuthFailure('METHOD_DISABLED', 403)
      const input = parseAuthInterface(forgotPasswordSchema, await readJSON(req))
      return createOwnershipOtpEndpoint(settings, options, 'send', { ...input, purpose: 'recovery' }).handler(req)
    } catch (error) { return authFailureResponse(error, req) }
  } }, { path: `${settings.authEndpointPrefix}/reauthenticate`, method: 'post', handler: async req => {
    try {
      assertAllowedOrigin(req)
      if (!settings.passwordLogin) throw new AuthFailure('METHOD_DISABLED', 403)
      const input = parseAuthInterface(reauthenticationSchema, await readJSON(req))
      const permit = await passwordReauthentication(req, settings.collection, input.password)
      return Response.json(lifecycle(req, settings, options).grant(permit), { headers: headersWithCors({ headers: new Headers({ 'Cache-Control': 'no-store' }), req }) })
    } catch (error) { return authFailureResponse(error, req) }
  } }]
}
