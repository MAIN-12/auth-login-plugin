import { createHash, randomBytes } from 'node:crypto'
import { AuthFailure } from '../domain/login'
import { safeAuthRedirect } from '../domain/redirect'
import type { OtpStore } from '../domain/otp'
export interface GoogleIdentity { sub: string; email?: string; emailVerified: boolean; authenticatedAt?: number; amr?: string[] }
export interface GoogleCorrelation { state: string; nonce: string; verifier: string; browser: string; returnTo: string; expiresAt: number; purpose: 'login' | 'link' | 'reauth'; permit?: string; popup?: boolean; principal?: { id: string | number; sid: string; version: string; email: string } }
/** OAuth application owner: order, browser binding, lifetime and irreversible consumption.
 * Provider transport, durable storage, account policy and native sessions are explicit boundaries.
 */
export function createGoogleFlow<T>(dependencies: { store: OtpStore; namespace?: string; now?: () => number; authorize: (correlation: GoogleCorrelation) => Promise<string>; exchange: (url: string, correlation: GoogleCorrelation) => Promise<GoogleIdentity>; finish: (identity: GoogleIdentity, correlation: GoogleCorrelation) => Promise<T> }) {
  const now = dependencies.now ?? Date.now
  const key = (state: string) => `google:${createHash('sha256').update(dependencies.namespace ? JSON.stringify([dependencies.namespace, state]) : state).digest('hex')}`
  const random = () => randomBytes(32).toString('base64url')
  return {
    async start(input: { browser: string; returnTo?: string; purpose?: GoogleCorrelation['purpose']; permit?: string; popup?: boolean; principal?: GoogleCorrelation['principal'] }) {
      const correlation: GoogleCorrelation = { state: random(), nonce: random(), verifier: random(), browser: input.browser, returnTo: safeAuthRedirect(input.returnTo), expiresAt: now() + 600_000, purpose: input.purpose ?? 'login', permit: input.permit, popup: input.popup, principal: input.principal }
      const url = await dependencies.authorize(correlation)
      await dependencies.store.transaction([key(correlation.state)], async state => state.put(key(correlation.state), { ...correlation }))
      return { state: correlation.state, url }
    },
    async callback(state: string, browser: string, url: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !browser) throw new AuthFailure('AUTH_FAILED', 401)
      const correlation = await dependencies.store.transaction([key(state)], async store => {
        const stored = await store.get(key(state)) as unknown as GoogleCorrelation | undefined
        if (!stored || stored.browser !== browser || stored.expiresAt <= now() || stored.state !== state) throw new AuthFailure('AUTH_FAILED', 401)
        await store.put(key(state), { expiresAt: 0 })
        return stored
      })
      // All token, signature, account and session failures burn the correlation.
      const identity = await dependencies.exchange(url, correlation)
      const result = await dependencies.finish(identity, correlation)
      return { result, returnTo: correlation.returnTo, ...(correlation.popup ? { popup: true } : {}) }
    },
  }
}
