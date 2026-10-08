import { generatePayloadCookie, headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import type { OtpOptions, PublicAuthConfig } from '../../../config'
import type { createOtpLoginScope } from '../../composition/otpLogin'
import type { OtpSendCommand, OtpVerifyCommand, Outcome } from '../../application/models'
import { AuthOperationFailure } from '../../domain/errors'
import { AuthFailure, authStatus } from '../../contracts/errors'
import { otpSendSchema, otpVerifySchema, parseAuthInterface } from '../../../endpoints/authSchemas'
import { readJSON, assertAllowedOrigin, authFailureResponse } from './authTransport'
export function otpEndpoints(
  settings: PublicAuthConfig,
  options: OtpOptions | undefined,
  scopeFor: (req: PayloadRequest) => ReturnType<typeof createOtpLoginScope>,
  ownership: (
    action: string,
    input: unknown,
    req: PayloadRequest,
  ) => ReturnType<Endpoint['handler']>,
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
      if (purpose.input && purpose.purpose !== 'login') return ownership(action, purpose.input, req)
      try {
        assertAllowedOrigin(req)
        const input = purpose.input
        const scope = scopeFor(req)
        try {
          if (action === 'send') {
            let origin: string | null
            try {
              origin = await options.origin(req)
            } catch {
              origin = null
            }
            return Response.json(unwrapOtp(await scope.send(input as OtpSendCommand, origin)), {
              headers: headersWithCors({
                headers: new Headers({ 'Cache-Control': 'no-store' }),
                req,
              }),
            })
          }
          unwrapOtp(await scope.verify(input as OtpVerifyCommand))
          const result = scope.takeReceipt()
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
            {
              headers: headersWithCors({
                headers: new Headers({ 'Set-Cookie': cookie, 'Cache-Control': 'no-store' }),
                req,
              }),
            },
          )
        } finally {
          scope.dispose()
        }
      } catch (error) {
        return authFailureResponse(
          error instanceof AuthOperationFailure
            ? new AuthFailure(error.code, authStatus[error.code])
            : error instanceof AuthFailure
              ? error
              : new AuthFailure('AUTH_UNAVAILABLE', 503),
          req,
        )
      }
    },
  }))
}

function unwrapOtp<T>(result: Outcome<T>): T {
  if (!result.ok) throw new AuthOperationFailure(result.code)
  return result.value
}
