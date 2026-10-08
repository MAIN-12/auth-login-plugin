import { selectEmailLocale } from '../auth/domain/emailPresentation'
import { createOtpEndpoints } from '../auth/composition/otpLogin'
import {
  generatePayloadCookie,
  headersWithCors,
  refreshOperation,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../config'
import { assertAllowedOrigin, authFailureResponse } from '../auth/interface/http/authTransport'
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

import { createPasswordEndpoints } from './passwordEndpoints'

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

/** Browser locale is explicit; unsupported values use the configured per-instance fallback. */
export function requestEmailSettings(req: PayloadRequest, options: OtpOptions) {
  const locale = req.headers.get('accept-language')
  return {
    ...options.email!,
    locale: selectEmailLocale(locale, options.email!.locale),
  }
}
