import { generatePayloadCookie, headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig, OtpOptions } from '../../../config'
import type { createOwnershipScope } from '../../composition/ownership'
import { AuthOperationFailure } from '../../domain/errors'
import { AuthFailure, authStatus } from '../../contracts/errors'
import {
  ownershipSendSchema,
  ownershipVerifySchema,
  forgotPasswordSchema,
  reauthenticationSchema,
  passwordCompletionSchema,
  parseAuthInterface,
} from './authSchemas'
import { assertAllowedOrigin, authFailureResponse, readJSON } from './authTransport'
type ScopeFactory = (req: PayloadRequest) => ReturnType<typeof createOwnershipScope>
const headers = (req: PayloadRequest) =>
  headersWithCors({ headers: new Headers({ 'Cache-Control': 'no-store' }), req })
function failure(error: unknown, req: PayloadRequest) {
  return authFailureResponse(
    error instanceof AuthOperationFailure
      ? new AuthFailure(error.code, authStatus[error.code])
      : error,
    req,
  )
}
async function origin(req: PayloadRequest, options?: OtpOptions) {
  try {
    return options ? await options.origin(req) : null
  } catch {
    return null
  }
}
export function ownershipOtpEndpoint(
  settings: PublicAuthConfig,
  options: OtpOptions | undefined,
  action: string,
  scopeFor: ScopeFactory,
  parsed?: unknown,
): Endpoint {
  return {
    path: `${settings.authEndpointPrefix}/otp/${action}`,
    method: 'post',
    handler: async (req) => {
      try {
        assertAllowedOrigin(req)
        const input = parseAuthInterface(
          action === 'send' ? ownershipSendSchema : ownershipVerifySchema,
          parsed ?? (await readJSON(req)),
        )
        const scope = scopeFor(req)
        try {
          const result =
            action === 'send'
              ? await scope.send(input, await origin(req, options))
              : await scope.verify(parseAuthInterface(ownershipVerifySchema, input))
          return Response.json(result, { headers: headers(req) })
        } finally {
          scope.dispose()
        }
      } catch (error) {
        return failure(error, req)
      }
    },
  }
}
export function passwordEndpoints(
  settings: PublicAuthConfig,
  options: OtpOptions | undefined,
  scopeFor: ScopeFactory,
): Endpoint[] {
  return [
    ...(['signup', 'reset-password', 'set-password'] as const).map((path): Endpoint => ({
      path: `${settings.authEndpointPrefix}/${path}`,
      method: 'post',
      handler: async (req) => {
        try {
          assertAllowedOrigin(req)
          const scope = scopeFor(req)
          try {
            scope.admitCompletion(
              path === 'signup' ? 'signup' : path === 'reset-password' ? 'recovery' : 'reauth',
            )
            const input = parseAuthInterface(passwordCompletionSchema, await readJSON(req))
            await scope.complete(
              path === 'signup' ? 'signup' : path === 'reset-password' ? 'recovery' : 'reauth',
              input,
            )
            const result = scope.takeReceipt()
            const responseHeaders = new Headers({ 'Cache-Control': 'no-store' })
            const collection = req.payload.collections[settings.collection]
            if (result.token)
              responseHeaders.set(
                'Set-Cookie',
                generatePayloadCookie({
                  collectionAuthConfig: {
                    ...collection.config.auth,
                    tokenExpiration: Math.max(1, result.exp! - Math.floor(Date.now() / 1000)),
                  },
                  cookiePrefix: req.payload.config.cookiePrefix,
                  token: result.token,
                }),
              )
            return Response.json(
              {
                success: true,
                ...(result.exp ? { exp: result.exp } : {}),
                ...(!collection.config.auth.removeTokenFromResponses && result.token
                  ? { token: result.token }
                  : {}),
              },
              { headers: headersWithCors({ headers: responseHeaders, req }) },
            )
          } finally {
            scope.dispose()
          }
        } catch (error) {
          return failure(error, req)
        }
      },
    })),
    {
      path: `${settings.authEndpointPrefix}/forgot-password`,
      method: 'post',
      handler: async (req) => {
        try {
          const scope = scopeFor(req)
          try {
            scope.admitMethod('recovery', true)
            assertAllowedOrigin(req)
            const input = parseAuthInterface(forgotPasswordSchema, await readJSON(req))
            return Response.json(
              await scope.send({ ...input, purpose: 'recovery' }, await origin(req, options)),
              { headers: headers(req) },
            )
          } finally {
            scope.dispose()
          }
        } catch (error) {
          return failure(error, req)
        }
      },
    },
    {
      path: `${settings.authEndpointPrefix}/reauthenticate`,
      method: 'post',
      handler: async (req) => {
        try {
          assertAllowedOrigin(req)
          const scope = scopeFor(req)
          try {
            scope.admitMethod('reauth', false)
            const input = parseAuthInterface(reauthenticationSchema, await readJSON(req))
            return Response.json(await scope.reauthenticate(input), { headers: headers(req) })
          } finally {
            scope.dispose()
          }
        } catch (error) {
          return failure(error, req)
        }
      },
    },
  ]
}
