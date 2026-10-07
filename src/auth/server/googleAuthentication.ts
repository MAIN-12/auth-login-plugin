import { readCutoverGeneration } from './cutoverGeneration'
import type { PayloadRequest } from 'payload'
import type { PublicAuthConfig } from '../../config'
import { createGoogleFlow, type GoogleCorrelation } from '../application/googleFlow'
import { createGoogleProvider } from './googleProvider'
import { createPayloadOtpStore } from './otpStore'
import { credentialVersion } from './credentialRequest'
import { methodPermits, resolveGoogleAccount } from './googleAccount'
import { createOtpSession } from './otpSession'
import { AuthFailure } from '../domain/login'
/** Native-integrated application adapter: verified callback capability remains closure-local.
 * Framework-free correlation/account policy calls this explicitly Payload-bound workflow.
 */
export async function createGoogleAuthentication(
  req: PayloadRequest,
  settings: PublicAuthConfig,
  provider: ReturnType<typeof createGoogleProvider>,
  redirectURI: string,
  now: () => number,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
) {
  const generation = await readCutoverGeneration(req, settings.collection)
  const flow = createGoogleFlow({
    store: createPayloadOtpStore(req),
    namespace: generation ? JSON.stringify([settings.collection, generation]) : undefined,
    now,
    ...provider,
    finish: async (identity, correlation) => {
      if (correlation.purpose !== 'login') {
        // Reached only after durable browser correlation consumption and verified OIDC signature.
        // OAuth state replaces Origin CSRF on this cross-site GET, not native session authority.
        const headers = new Headers(req.headers)
        headers.set('Origin', new URL(redirectURI).origin)
        headers.set('Sec-Fetch-Site', 'same-origin')
        const authenticated = await req.payload.auth({
          headers,
          req: { ...req, headers },
          canSetHeaders: false,
        })
        req.user = authenticated.user
        if (
          !req.user ||
          req.user.collection !== settings.collection ||
          req.user.id !== correlation.principal?.id ||
          String(req.user._sid) !== correlation.principal.sid
        )
          throw new AuthFailure('AUTH_FAILED', 401)
      }
      const resolved = await resolveGoogleAccount(
        req,
        settings,
        identity,
        correlation,
        now,
        assertPublicAccount,
      )
      if (correlation.purpose !== 'login') return resolved.permit ?? { success: true }
      return createOtpSession(
        req,
        resolved.account.id,
        settings.collection,
        String(resolved.account.email),
        credentialVersion(req.payload.secret, resolved.account),
        { method: 'google', authenticatedAt: identity.authenticatedAt, amr: identity.amr },
      )
    },
  })
  return {
    ...flow,
    start: async (input: {
      browser: string
      returnTo?: string
      purpose?: GoogleCorrelation['purpose']
      permit?: string
      popup?: boolean
    }) => {
      let principal: GoogleCorrelation['principal']
      if (input.purpose && input.purpose !== 'login') {
        if (!req.user || req.user.collection !== settings.collection || !req.user._sid)
          throw new AuthFailure('UNAUTHENTICATED', 401)
        const record = await req.payload.db.findOne<NonNullable<PayloadRequest['user']>>({
          collection: settings.collection,
          req,
          where: { id: { equals: req.user.id } },
        })
        if (!record) throw new AuthFailure('AUTH_FAILED', 401)
        principal = {
          id: req.user.id,
          sid: String(req.user._sid),
          version: credentialVersion(req.payload.secret, record),
          email: String(record.email),
        }
        if (input.permit) {
          const permit = (await methodPermits(req, settings, now)).readPermit(
            'reauth',
            input.permit,
          )
          if (
            permit.account !== principal.id ||
            permit.sid !== principal.sid ||
            permit.version !== principal.version ||
            permit.email !== principal.email
          )
            throw new AuthFailure('AUTH_FAILED', 401)
        }
      }
      return flow.start({ ...input, principal })
    },
  }
}
