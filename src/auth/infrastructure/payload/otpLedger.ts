import type { OtpLedger, OtpLedgerState } from '../../application/ports/otp'
export interface OtpStateAccess {
  get(key: string): Promise<Record<string, unknown> | undefined>
  put(key: string, value: Record<string, unknown>): Promise<void>
}
export interface OtpStore {
  transaction<T>(keys: string[], work: (state: OtpStateAccess) => Promise<T>): Promise<T>
}

/** Native durable transaction/serialization only; no memory fallback. */
export function createOtpLedger(store: OtpStore): OtpLedger {
  return {
    reserve: (keys, work) =>
      store.transaction(keys, (state) =>
        work({
          readChallenge: state.get,
          writeChallenge: state.put,
          readBudget: state.get,
          writeBudget: state.put,
        } as OtpLedgerState),
      ),
    consume: (key, work) =>
      store.transaction([key], (state) =>
        work({ readChallenge: state.get, writeChallenge: state.put }),
      ),
  }
}
