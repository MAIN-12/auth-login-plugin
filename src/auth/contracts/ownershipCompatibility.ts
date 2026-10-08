import { createOwnershipVerification as createVerification } from '../application/use-cases/ownershipVerification'
import type { OtpDependencies } from './otpCompatibility'
import type { OwnershipPrincipal, OwnershipProof } from '../application/ports/ownership'
import { createOtpCodec } from '../infrastructure/crypto/otpCodec'
import { createOtpLedger } from '../infrastructure/payload/otpLedger'
import { mapOwnershipAccount, type LegacyOwnershipAccount } from '../server/ownershipAccount'
export type OwnershipAccount = LegacyOwnershipAccount
export type { OwnershipPrincipal, OwnershipProof }
/** Temporary compatibility for callers not yet migrated; remove in auth-clean 06. */
export function createOwnershipVerification<T>(
  dependencies: Omit<
    OtpDependencies<T>,
    'findAccount' | 'session' | 'quotaIdentity' | 'purpose'
  > & {
    purpose: OwnershipProof['purpose']
    findOwnershipAccount: (email: string) => Promise<OwnershipAccount | null>
    credentialVersion: (account: OwnershipAccount) => string
    principal: OwnershipPrincipal | null
    grant: (permit: OwnershipProof) => Promise<T>
  },
) {
  return createVerification({
    ...dependencies,
    now: dependencies.now ?? Date.now,
    codec: createOtpCodec(dependencies.secret),
    ledger: createOtpLedger(dependencies.store),
    findOwnershipAccount: async (email) => {
      const account = await dependencies.findOwnershipAccount(email)
      return account ? mapOwnershipAccount(account, dependencies.credentialVersion(account)) : null
    },
  })
}
