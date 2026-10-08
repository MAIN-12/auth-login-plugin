import { createGoogleFlow as createFlow } from '../application/use-cases/googleFlow'
import { createGoogleCorrelationCrypto } from '../infrastructure/crypto/googleCorrelationCrypto'
import { createGoogleCorrelations } from '../infrastructure/payload/googleCorrelations'
import type { OtpStore } from '../infrastructure/payload/otpLedger'
import type { GoogleCorrelation, GoogleIdentity } from '../application/ports/google'
/** Legacy trusted caller seam. Production composition always supplies explicit admission. */
export function createGoogleFlow<T>(dependencies: {
  store: OtpStore
  namespace?: string
  now?: () => number
  authorize(correlation: GoogleCorrelation): Promise<string>
  exchange(url: string, correlation: GoogleCorrelation): Promise<GoogleIdentity>
  finish(identity: GoogleIdentity, correlation: GoogleCorrelation): Promise<T>
}) {
  const crypto = createGoogleCorrelationCrypto(dependencies.namespace)
  const flow = createFlow({
    ...dependencies,
    enabled: true,
    now: dependencies.now ?? Date.now,
    crypto,
    correlations: createGoogleCorrelations(dependencies.store, crypto.key),
    provider: dependencies,
    authorizeStart: async () => undefined,
    readPermit: async () => {
      throw new Error('Legacy linking requires explicit composition')
    },
  })
  return {
    start: flow.start,
    callback: async (state: string, browser: string, url: string) => {
      const { purpose: _purpose, ...result } = await flow.callback({ state, browser, url })
      return result
    },
  }
}
