import { AuthOperationFailure } from '../../domain/errors'
import * as oauth from 'oauth4webapi'
import type { GoogleCorrelation, GoogleIdentity } from '../../application/ports/google'
import type { GoogleOptions } from '../../../googleOptions'
export type { GoogleOptions } from '../../../googleOptions'
/** Pinned maintained OIDC protocol implementation; never accepts an unverified JWT payload. */
export function createGoogleProvider(options: GoogleOptions) {
  const issuer = new URL('https://accounts.google.com')
  const client: oauth.Client = {
    client_id: options.clientId!,
    id_token_signed_response_alg: 'RS256',
  }
  const transport = {
    signal: () => AbortSignal.timeout(5000),
    ...(options.customFetch ? { [oauth.customFetch]: options.customFetch } : {}),
  }
  // Per-plugin metadata promise, no cross-consumer process-global state.
  let discovery: Promise<oauth.AuthorizationServer> | undefined
  const metadata = () =>
    (discovery ??= oauth
      .discoveryRequest(issuer, transport)
      .then((response) => oauth.processDiscoveryResponse(issuer, response))
      .catch((error) => {
        discovery = undefined
        throw error
      }))
  return {
    async authorize(correlation: GoogleCorrelation) {
      const as = await metadata()
      const url = new URL(as.authorization_endpoint!)
      const params = {
        client_id: client.client_id,
        redirect_uri: options.redirectURI!,
        response_type: 'code',
        scope: 'openid email',
        state: correlation.state,
        nonce: correlation.nonce,
        code_challenge_method: 'S256',
        code_challenge: await oauth.calculatePKCECodeChallenge(correlation.verifier),
        ...(correlation.purpose === 'reauth' ? { prompt: 'login', max_age: '0' } : {}),
      }
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
      return url.href
    },
    async exchange(url: string, correlation: GoogleCorrelation): Promise<GoogleIdentity> {
      try {
        const as = await metadata()
        const params = oauth.validateAuthResponse(as, client, new URL(url), correlation.state)
        const response = await oauth.authorizationCodeGrantRequest(
          as,
          client,
          oauth.ClientSecretPost(options.clientSecret!),
          params,
          options.redirectURI!,
          correlation.verifier,
          transport,
        )
        const tokens = await oauth.processAuthorizationCodeResponse(as, client, response, {
          expectedNonce: correlation.nonce,
          requireIdToken: true,
        })
        await oauth.validateApplicationLevelSignature(as, response, transport)
        const claims = oauth.getValidatedIdTokenClaims(tokens)!
        return {
          sub: claims.sub,
          email: typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : undefined,
          emailVerified: claims.email_verified === true,
          authenticatedAt:
            typeof claims.auth_time === 'number' ? claims.auth_time * 1000 : undefined,
          amr:
            Array.isArray(claims.amr) && claims.amr.every((value) => typeof value === 'string')
              ? (claims.amr as string[])
              : undefined,
        }
      } catch (error) {
        if (
          error instanceof oauth.AuthorizationResponseError ||
          error instanceof oauth.ResponseBodyError ||
          error instanceof oauth.OperationProcessingError ||
          error instanceof oauth.WWWAuthenticateChallengeError
        )
          throw new AuthOperationFailure('AUTH_FAILED')
        throw error
      }
    },
  }
}
