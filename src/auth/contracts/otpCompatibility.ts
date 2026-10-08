import { createOtpProtocol } from '../application/use-cases/otpProtocol'
import type { OtpProtocolDependencies } from '../application/ports/otp'
import { createOtpCodec } from '../infrastructure/crypto/otpCodec'
import { AuthOperationFailure } from '../domain/errors'
import { AuthFailure, authStatus } from './errors'
import { createOtpLedger, type OtpStore } from '../infrastructure/payload/otpLedger'
export type { OtpStore, OtpStateAccess } from '../infrastructure/payload/otpLedger'
export type OtpDependencies<T> = Omit<OtpProtocolDependencies<T>, 'codec' | 'now' | 'ledger'> & {
  store: OtpStore
  secret: string
  now?: () => number
}
/** Ownership compatibility for 03; legacy entry point retired in 06. */
export function createOtpFlow<T>(dependencies: OtpDependencies<T>) {
  const flow = createOtpProtocol({
    ...dependencies,
    ledger: createOtpLedger(dependencies.store),
    now: dependencies.now ?? Date.now,
    codec: createOtpCodec(dependencies.secret),
  })
  async function compatible<R>(work: () => Promise<R>): Promise<R> {
    try {
      return await work()
    } catch (error) {
      if (error instanceof AuthOperationFailure)
        throw new AuthFailure(error.code, authStatus[error.code])
      throw error
    }
  }
  return {
    send: (input: unknown, origin: string | null) => compatible(() => flow.send(input, origin)),
    verify: (input: unknown) => compatible(() => flow.verify(input)),
  }
}
