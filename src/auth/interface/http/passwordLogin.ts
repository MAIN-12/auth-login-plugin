import {
  generatePayloadCookie,
  headersWithCors,
  type PayloadRequest,
  type Endpoint,
  type JsonObject,
  type TypeWithID,
} from 'payload'
import type { PublicAuthConfig } from '../../../config'
import { credentialCapabilities } from '../../domain/credentials'
import { AuthOperationFailure } from '../../domain/errors'
import type { Outcome, PasswordLoginCommand, PasswordLoginResult } from '../../application/models'
import { assertAllowedOrigin, authFailureResponse, readJSON } from './authTransport'
import { authStatus, AuthFailure } from '../../contracts/errors'

interface PasswordLoginScope {
  login: (command: PasswordLoginCommand) => Promise<Outcome<PasswordLoginResult>>
  takeReceipt: () => { user?: JsonObject & TypeWithID; token?: string; exp?: number }
  dispose: () => void
}
export function passwordLoginEndpoint(
  settings: PublicAuthConfig,
  scopeFor: (req: PayloadRequest) => PasswordLoginScope,
  path?: string,
): Endpoint {
  return {
    path: path ?? `${settings.authEndpointPrefix}/login`,
    method: 'post',
    handler: async (req) => {
      let scope: PasswordLoginScope | undefined
      try {
        assertAllowedOrigin(req)
        const input = await readJSON(req)
        scope = scopeFor(req)
        const result = await scope.login(input as PasswordLoginCommand)
        if (!result.ok) throw new AuthOperationFailure(result.code)
        const receipt = scope.takeReceipt()
        if (
          !receipt.user ||
          !receipt.token ||
          typeof receipt.exp !== 'number' ||
          !Number.isFinite(receipt.exp)
        )
          throw new AuthOperationFailure('AUTH_UNAVAILABLE')
        const collection = req.payload.collections[settings.collection]
        const cookie = generatePayloadCookie({
          collectionAuthConfig: {
            ...collection.config.auth,
            tokenExpiration: Math.max(1, receipt.exp - Math.floor(Date.now() / 1000)),
          },
          cookiePrefix: req.payload.config.cookiePrefix,
          token: receipt.token,
        })
        return Response.json(
          {
            success: true,
            user: receipt.user,
            exp: receipt.exp,
            capabilities: credentialCapabilities({
              passwordAuthenticated: true,
              verified: receipt.user._verified,
            }),
            ...(!collection.config.auth.removeTokenFromResponses ? { token: receipt.token } : {}),
          },
          { headers: headersWithCors({ headers: new Headers({ 'Set-Cookie': cookie }), req }) },
        )
      } catch (error) {
        const failure =
          error instanceof AuthOperationFailure
            ? new AuthFailure(error.code, authStatus[error.code])
            : error instanceof AuthFailure
              ? error
              : new AuthFailure('AUTH_UNAVAILABLE', 503)
        const response = authFailureResponse(failure, req)
        try {
          req.payload.logger?.info({
            event: 'auth.login.rejected',
            correlation: response.headers.get('X-Auth-Request-ID'),
          })
        } catch {
          /* Logging cannot grant access. */
        }
        return response
      } finally {
        scope?.dispose()
      }
    },
  }
}
