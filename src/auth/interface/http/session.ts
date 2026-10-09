import { generatePayloadCookie, headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import type { PublicAuthConfig } from '../../../config'
import type { CredentialCapabilities } from '../../domain/credentials'
import type { Outcome } from '../../application/models'
import { AuthFailure, authStatus } from '../../contracts/errors'
import { assertAllowedOrigin, authFailureResponse } from './authTransport'

interface CapabilitiesScope {
  capabilities(): Promise<Outcome<CredentialCapabilities>>
  dispose(): void
}
export function capabilitiesEndpoint(
  settings: PublicAuthConfig,
  scopeFor: (req: PayloadRequest) => CapabilitiesScope,
): Endpoint {
  return {
    path: `${settings.authEndpointPrefix}/credentials`,
    method: 'get',
    handler: async (req) => {
      const scope = scopeFor(req)
      try {
        const result = await scope.capabilities()
        if (!result.ok) throw new AuthFailure(result.code, authStatus[result.code])
        return Response.json({ capabilities: result.value })
      } catch (error) {
        return authFailureResponse(error, req)
      } finally {
        scope.dispose()
      }
    },
  }
}

export interface RefreshScope {
  refresh(): Promise<Outcome<{ expiresAt: number }>>
  takeReceipt(): { exp: number; refreshedToken: string; user?: unknown; setCookie?: boolean }
  dispose(): void
}
export function refreshEndpoint(
  settings: PublicAuthConfig,
  scopeFor: (req: PayloadRequest) => RefreshScope,
): Endpoint {
  return {
    path: '/refresh-token',
    method: 'post',
    handler: async (req) => {
      let scope: RefreshScope | undefined
      try {
        assertAllowedOrigin(req)
        scope = scopeFor(req)
        const collection = req.payload.collections[settings.collection]
        const outcome = await scope.refresh()
        if (!outcome.ok) throw new AuthFailure(outcome.code, authStatus[outcome.code])
        const result = scope.takeReceipt()
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
      } finally {
        scope?.dispose()
      }
    },
  }
}
