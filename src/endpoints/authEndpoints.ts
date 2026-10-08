import { readCutoverGeneration } from '../auth/server/cutoverGeneration'
import { randomBytes } from 'node:crypto'
import {
  generatePayloadCookie,
  headersWithCors,
  refreshOperation,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../config'
import {
  readJSON,
  assertAllowedOrigin,
  authFailureResponse,
} from '../auth/interface/http/authTransport'
export {
  readJSON,
  assertAllowedOrigin,
  authFailureResponse,
} from '../auth/interface/http/authTransport'
import { AuthFailure } from '../auth/domain/login'
import { createPasswordLoginEndpoint } from '../auth/composition/passwordLogin'
/** Compatibility entry point, retired by auth-clean 06. */
export { createPasswordLoginEndpoint } from '../auth/composition/passwordLogin'
import { readCredentialCapabilities } from '../auth/server/credentialEvidence'

import {
  decodeProofBinding,
  encodeProofBinding,
  proofQuotaIdentity,
} from '../auth/domain/proofBinding'
import { otpSendSchema, otpVerifySchema, parseAuthInterface } from './authSchemas'
import { createOtpFlow } from '../auth/domain/otp'
import { createPayloadOtpStore } from '../auth/server/otpStore'
import { credentialVersion } from '../auth/server/credentialRequest'
import { createOtpSession } from '../auth/server/otpSession'
import { createPasswordEndpoints, createOwnershipOtpEndpoint } from './passwordEndpoints'
import { otpEmail } from '../auth/server/otpEmail'

export function createAuthEndpoints(
  settings: PublicAuthConfig,
  otpOptions?: OtpOptions,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
): Endpoint[] {
  const disabled: Endpoint['handler'] = (req) =>
    authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
  return [
    createPasswordLoginEndpoint(settings),
    ...createOtpEndpoints(settings, otpOptions, assertPublicAccount),
    ...createPasswordEndpoints(settings, otpOptions, assertPublicAccount),
    { path: `${settings.authEndpointPrefix}/check-email`, method: 'post', handler: disabled },
    {
      path: `${settings.authEndpointPrefix}/credentials`,
      method: 'get',
      handler: async (req) => {
        if (!req.user || req.user.collection !== settings.collection)
          return authFailureResponse(new AuthFailure('UNAUTHENTICATED', 401), req)
        try {
          return Response.json({
            capabilities: await readCredentialCapabilities(req, settings.collection),
          })
        } catch {
          return authFailureResponse(new AuthFailure('AUTH_UNAVAILABLE', 503), req)
        }
      },
    },
    ...['oauth/google', 'oauth/google/callback'].map((path) => ({
      path: `${settings.authEndpointPrefix}/${path}`,
      method: 'post' as const,
      handler: disabled,
    })),
  ]
}

export function createRefreshEndpoint(settings: PublicAuthConfig): Endpoint {
  return {
    path: '/refresh-token',
    method: 'post',
    handler: async (req) => {
      try {
        assertAllowedOrigin(req)
        const collection = req.payload.collections[settings.collection]
        const result = await refreshOperation({ collection, req })
        const headers = new Headers()
        if (result.setCookie) {
          const tokenLifetime = Math.max(1, result.exp - Math.floor(Date.now() / 1000))
          headers.set(
            'Set-Cookie',
            generatePayloadCookie({
              collectionAuthConfig: { ...collection.config.auth, tokenExpiration: tokenLifetime },
              cookiePrefix: req.payload.config.cookiePrefix,
              token: result.refreshedToken,
            }),
          )
        }
        return Response.json(
          {
            success: true,
            user: result.user,
            exp: result.exp,
            ...(!collection.config.auth.removeTokenFromResponses
              ? { refreshedToken: result.refreshedToken }
              : {}),
          },
          { headers: headersWithCors({ headers, req }) },
        )
      } catch (error) {
        return authFailureResponse(error, req)
      }
    },
  }
}

function createOtpEndpoints(
  settings: PublicAuthConfig,
  options?: OtpOptions,
  assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>,
): Endpoint[] {
  return ['send', 'verify'].map((action) => ({
    path: `${settings.authEndpointPrefix}/otp/${action}`,
    method: 'post',
    handler: async (req) => {
      if (!options) return authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
      let purpose: { input: unknown; purpose: unknown }
      try {
        const input = parseAuthInterface(
          action === 'send' ? otpSendSchema : otpVerifySchema,
          await readJSON(req),
        )
        purpose = { input, purpose: input.purpose }
      } catch (error) {
        return authFailureResponse(error, req)
      }
      if (purpose.input && purpose.purpose !== 'login')
        return createOwnershipOtpEndpoint(
          settings,
          options,
          action,
          purpose.input,
          assertOriginalAdminDenied,
        ).handler(req)
      if (!settings.otpLogin || !options)
        return authFailureResponse(new AuthFailure('METHOD_DISABLED', 403), req)
      try {
        assertAllowedOrigin(req)
        const input = purpose.input
        let challengeGeneration: string
        try {
          challengeGeneration = await readCutoverGeneration(req, settings.collection)
        } catch (error) {
          try {
            req.payload.logger.info({
              event: 'auth.otp.unavailable',
              correlation: randomBytes(32).toString('hex'),
            })
          } catch {
            /* Logging cannot change the fail-closed response. */
          }
          throw error
        }
        const flow = createOtpFlow({
          ...options,
          collection: settings.collection,
          challengeGeneration,
          store: createPayloadOtpStore(req),
          findAccount: async (email) => {
            const account = await req.payload.db.findOne({
              collection: settings.collection,
              req,
              where: { email: { equals: email } },
            })
            return account
              ? encodeProofBinding({
                  accountID: account.id,
                  version: credentialVersion(req.payload.secret, account),
                })
              : null
          },
          quotaIdentity: proofQuotaIdentity,
          session: (account, email) => {
            const binding = decodeProofBinding(account)
            if (binding.accountID === null) throw new AuthFailure('AUTH_FAILED', 401)
            return createOtpSession(
              req,
              binding.accountID,
              settings.collection,
              email,
              binding.version,
              { method: 'otp' },
              assertOriginalAdminDenied,
            )
          },
          deliver: async ({ email, code }) => {
            const mail = otpEmail(code, requestEmailSettings(req, options))
            await req.payload.sendEmail({
              to: email,
              ...(options.email ? { from: options.email.from } : {}),
              ...mail,
            })
          },
          event: (event, correlation) =>
            req.payload.logger.info({ event: `auth.otp.${event}`, correlation }),
        })
        if (action === 'send') {
          let origin: string | null
          try {
            origin = await options.origin(req)
          } catch {
            origin = null
          }
          return Response.json(await flow.send(input, origin), {
            headers: headersWithCors({ headers: new Headers(), req }),
          })
        }
        const result = await flow.verify(input)
        const collection = req.payload.collections[settings.collection]
        const cookie = generatePayloadCookie({
          collectionAuthConfig: {
            ...collection.config.auth,
            tokenExpiration: Math.max(1, result.exp - Math.floor(Date.now() / 1000)),
          },
          cookiePrefix: req.payload.config.cookiePrefix,
          token: result.token,
        })
        return Response.json(
          {
            success: true,
            user: result.user,
            exp: result.exp,
            ...(!collection.config.auth.removeTokenFromResponses ? { token: result.token } : {}),
          },
          { headers: headersWithCors({ headers: new Headers({ 'Set-Cookie': cookie }), req }) },
        )
      } catch (error) {
        return authFailureResponse(error, req)
      }
    },
  }))
}

/** Browser locale is explicit; unsupported values use the configured per-instance fallback. */
export function requestEmailSettings(req: PayloadRequest, options: OtpOptions) {
  const locale = req.headers.get('accept-language')
  return {
    ...options.email!,
    locale: locale === 'es' || locale === 'en' ? locale : options.email!.locale,
  }
}
