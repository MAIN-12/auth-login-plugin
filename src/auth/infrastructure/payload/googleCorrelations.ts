import { AuthOperationFailure } from '../../domain/errors'
import type { GoogleCorrelation, GoogleCorrelations } from '../../application/ports/google'
import type { OtpStore } from './otpLedger'
/** Durable reservation/burn. Storage failures propagate; there is no memory fallback. */
export function createGoogleCorrelations(
  store: OtpStore,
  key: (state: string) => string,
  binding?: { collection: string; origin: string; generation: string },
): GoogleCorrelations {
  const context = binding
    ? JSON.stringify([binding.collection, binding.origin, binding.generation])
    : undefined
  return {
    save: (correlation) =>
      store.transaction([key(correlation.state)], async (state) =>
        state.put(key(correlation.state), {
          ...correlation,
          ...(context !== undefined ? { binding: context } : {}),
        }),
      ),
    consume: (state, browser, now) =>
      store.transaction([key(state)], async (store) => {
        const stored = (await store.get(key(state))) as unknown as
          (GoogleCorrelation & { binding?: string }) | undefined
        if (
          !stored ||
          (context !== undefined && stored.binding !== context) ||
          stored.browser !== browser ||
          !Number.isFinite(stored.expiresAt) ||
          stored.expiresAt <= now ||
          stored.state !== state ||
          !['login', 'link', 'reauth'].includes(stored.purpose) ||
          typeof stored.nonce !== 'string' ||
          typeof stored.verifier !== 'string'
        )
          throw new AuthOperationFailure('AUTH_FAILED')
        await store.put(key(state), { expiresAt: 0 })
        return stored
      }),
  }
}
