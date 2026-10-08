import { createGoogleProvider } from '../infrastructure/providers/googleProvider'
import type { GoogleOptions } from '../../googleOptions'
import { googleEndpoints } from '../interface/http/google'
import { readCutoverGeneration } from '../server/cutoverGeneration'
import type { Endpoint, PayloadRequest } from 'payload'
import type { PublicAuthConfig } from '../../config'
import { createGoogleFlow } from '../application/use-cases/googleFlow'
import type { GoogleStart, GoogleProvider } from '../application/ports/google'
import { createGoogleCorrelationCrypto } from '../infrastructure/crypto/googleCorrelationCrypto'
import { createGoogleCorrelations } from '../infrastructure/payload/googleCorrelations'
import { AuthOperationFailure } from '../domain/errors'
import { createPayloadOtpStore } from '../server/otpStore'
import { credentialVersion } from '../server/credentialRequest'
import { methodPermits, resolveGoogleAccount } from '../infrastructure/payload/googleAccountCommit'
import { createOtpSession } from '../server/otpSession'
import { AuthFailure } from '../contracts/errors'
/** Native-integrated application adapter: verified callback capability remains closure-local.
 * Framework-free correlation/account policy calls this explicitly Payload-bound workflow.
 */
export function createGoogleScope(
  req: PayloadRequest,
  settings: PublicAuthConfig,
  provider: GoogleProvider,
  redirectURI: string,
  now: () => number,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
) {
  settings = Object.freeze({ ...settings })
  let active = true
  let used = false
  let receipt: Awaited<ReturnType<typeof createOtpSession>> | undefined
  const originalUser = req.user
  const originalHeaders = req.headers
  const prepare = async () => {
    const generation = await readCutoverGeneration(req, settings.collection)
    const assertCurrent = async () => {
      if ((await readCutoverGeneration(req, settings.collection)) !== generation)
        throw new AuthOperationFailure('AUTH_FAILED')
    }
    const crypto = createGoogleCorrelationCrypto(
      generation ? JSON.stringify([settings.collection, generation]) : undefined,
    )
    const flow = createGoogleFlow({
      enabled: settings.googleOAuthEnabled,
      crypto,
      correlations: createGoogleCorrelations(createPayloadOtpStore(req), crypto.key, {
        collection: settings.collection,
        origin: new URL(redirectURI).origin,
        generation,
      }),
      now,
      provider,
      readPermit: async (encoded) =>
        (await methodPermits(req, settings, now)).readPermit('reauth', encoded),
      authorizeStart: async (input) => {
        if (!input.purpose || input.purpose === 'login') return undefined
        if (!req.user || req.user.collection !== settings.collection || !req.user._sid)
          throw new AuthOperationFailure('UNAUTHENTICATED')
        const record = await req.payload.db.findOne<NonNullable<PayloadRequest['user']>>({
          collection: settings.collection,
          req,
          where: { id: { equals: req.user.id } },
        })
        if (!record || record._verified !== true || record.deletedAt)
          throw new AuthOperationFailure('AUTH_FAILED')
        return {
          id: req.user.id,
          sid: String(req.user._sid),
          version: credentialVersion(req.payload.secret, record),
          email: String(record.email),
        }
      },
      finish: async (identity, correlation) => {
        if (correlation.purpose !== 'login') {
          // Reached only after durable browser correlation consumption and verified OIDC signature.
          // OAuth state replaces Origin CSRF on this cross-site GET, not native session authority.
          const headers = new Headers(req.headers)
          headers.set('Origin', new URL(redirectURI).origin)
          headers.set('Sec-Fetch-Site', 'same-origin')
          req.headers = headers
          const authenticated = await req.payload.auth({
            headers,
            req,
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
          assertCurrent,
        )
        if (correlation.purpose !== 'login') return resolved.permit ?? { success: true }
        receipt = await createOtpSession(
          req,
          resolved.account.id,
          settings.collection,
          String(resolved.account.email),
          credentialVersion(req.payload.secret, resolved.account),
          { method: 'google', authenticatedAt: identity.authenticatedAt, amr: identity.amr },
          assertPublicAccount,
          assertCurrent,
        )
        return { success: true as const }
      },
    })
    return flow
  }
  async function run<T>(work: (flow: Awaited<ReturnType<typeof prepare>>) => Promise<T>) {
    if (!active || used) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
    used = true
    if (!settings.googleOAuthEnabled) throw new AuthOperationFailure('METHOD_DISABLED')
    try {
      return await work(await prepare())
    } catch (error) {
      receipt = undefined
      throw error
    } finally {
      req.user = originalUser
      req.headers = originalHeaders
    }
  }
  return {
    start: (input: GoogleStart) => run((flow) => flow.start(input)),
    callback: (state: string, browser: string, url: string) =>
      run((flow) => flow.callback({ state, browser, url })),
    takeReceipt: () => {
      if (!active || !receipt) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      const value = receipt
      receipt = undefined
      return value
    },
    dispose: () => {
      active = false
      receipt = undefined
    },
  }
}

/** Capture private provider options once per plugin; HTTP never assembles adapters. */
export function createGoogleEndpoints(
  settings: PublicAuthConfig,
  options?: GoogleOptions,
  now: () => number = Date.now,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
): Endpoint[] {
  const config = Object.freeze({ ...settings })
  const captured = options ? Object.freeze({ ...options }) : undefined
  const provider = captured?.enabled ? createGoogleProvider(captured) : undefined
  const disabledProvider: GoogleProvider = {
    authorize: async () => {
      throw new AuthOperationFailure('METHOD_DISABLED')
    },
    exchange: async () => {
      throw new AuthOperationFailure('METHOD_DISABLED')
    },
  }
  return googleEndpoints(config, captured?.redirectURI, !!provider, (req) =>
    createGoogleScope(
      req,
      { ...config, googleOAuthEnabled: config.googleOAuthEnabled && !!provider },
      provider ?? disabledProvider,
      captured?.redirectURI ?? '',
      now,
      assertPublicAccount,
    ),
  )
}
