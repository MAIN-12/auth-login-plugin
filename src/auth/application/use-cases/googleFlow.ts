import { AuthOperationFailure } from '../../domain/errors'
import { authorizeGoogleLink } from '../../domain/googleAccountPolicy'
import type { PasswordPermit } from '../../domain/passwordPermit'
import { safeAuthRedirect } from '../../domain/redirect'
import type {
  GoogleCorrelation,
  GoogleIdentity,
  GoogleProvider,
  GoogleCorrelations,
  GoogleStart,
  GoogleCallback,
} from '../ports/google'

/** Portable ordering owner. A consumed correlation never revives after later failures. */
export function createGoogleFlow<T>(dependencies: {
  enabled: boolean
  now: () => number
  crypto: { random(): string }
  correlations: GoogleCorrelations
  provider: GoogleProvider
  authorizeStart(input: GoogleStart): Promise<GoogleCorrelation['principal']>
  readPermit(encoded: string): Promise<PasswordPermit>
  finish(identity: GoogleIdentity, correlation: GoogleCorrelation): Promise<T>
}) {
  const admit = () => {
    if (!dependencies.enabled) throw new AuthOperationFailure('METHOD_DISABLED')
  }
  return {
    async start(input: GoogleStart) {
      admit()
      if (
        !input ||
        typeof input.browser !== 'string' ||
        !input.browser ||
        (input.purpose !== undefined && !['login', 'link', 'reauth'].includes(input.purpose)) ||
        (input.returnTo !== undefined &&
          (typeof input.returnTo !== 'string' || input.returnTo.length > 2048)) ||
        (input.popup !== undefined && typeof input.popup !== 'boolean') ||
        Object.keys(input).some(
          (key) => !['browser', 'returnTo', 'purpose', 'permit', 'popup'].includes(key),
        )
      )
        throw new AuthOperationFailure('INVALID_INPUT')
      const purpose = input.purpose ?? 'login'
      if (
        purpose === 'link' &&
        (typeof input.permit !== 'string' || !input.permit || input.permit.length > 2048)
      )
        throw new AuthOperationFailure('AUTH_FAILED')
      const principal = await dependencies.authorizeStart(input)
      if (
        purpose !== 'login' &&
        (!principal || !principal.sid || !principal.version || !principal.email)
      )
        throw new AuthOperationFailure('UNAUTHENTICATED')
      if (purpose === 'link')
        authorizeGoogleLink(principal!, await dependencies.readPermit(input.permit!))
      const correlation: GoogleCorrelation = {
        state: dependencies.crypto.random(),
        nonce: dependencies.crypto.random(),
        verifier: dependencies.crypto.random(),
        browser: input.browser,
        returnTo: safeAuthRedirect(input.returnTo),
        expiresAt: dependencies.now() + 600_000,
        purpose,
        permit: input.permit,
        popup: input.popup,
        principal,
      }
      const url = await dependencies.provider.authorize(correlation)
      await dependencies.correlations.save(correlation)
      return { state: correlation.state, url }
    },
    async callback(input: GoogleCallback) {
      admit()
      if (
        !input ||
        !/^[A-Za-z0-9_-]{43}$/.test(input.state) ||
        !input.browser ||
        typeof input.url !== 'string' ||
        Object.keys(input).some((key) => !['state', 'browser', 'url'].includes(key))
      )
        throw new AuthOperationFailure('AUTH_FAILED')
      const correlation = await dependencies.correlations.consume(
        input.state,
        input.browser,
        dependencies.now(),
      )
      const identity = await dependencies.provider.exchange(input.url, correlation)
      if (!identity || typeof identity.sub !== 'string' || !identity.sub)
        throw new AuthOperationFailure('AUTH_FAILED')
      const result = await dependencies.finish(identity, correlation)
      return {
        result,
        purpose: correlation.purpose,
        returnTo: correlation.returnTo,
        ...(correlation.popup ? { popup: true } : {}),
      }
    },
  }
}
