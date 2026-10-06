import { createOtpFlow, type OtpDependencies } from '../domain/otp'
import type { PasswordPermit } from '../domain/passwordLifecycle'
import { decodeProofBinding, encodeProofBinding, proofQuotaIdentity } from '../domain/proofBinding'
export interface OwnershipAccount { id: string | number; email: string; hash?: unknown; salt?: unknown; verified?: unknown; deleted?: unknown }
export interface OwnershipPrincipal { id: string | number; sid?: string }
/** Ownership eligibility is an application rule with explicit native account/evidence dependencies. */
export function createOwnershipVerification<T>(dependencies: Omit<OtpDependencies<T>, 'findAccount' | 'session' | 'quotaIdentity' | 'purpose'> & {
  purpose: PasswordPermit['purpose']
  findOwnershipAccount: (email: string) => Promise<OwnershipAccount | null>
  credentialVersion: (account: OwnershipAccount) => string
  principal: OwnershipPrincipal | null
  grant: (permit: PasswordPermit) => Promise<T>
}) {
  const { purpose } = dependencies
  return createOtpFlow({ ...dependencies, purpose,
    findAccount: async email => {
      const account = await dependencies.findOwnershipAccount(email)
      if (purpose === 'signup') return account ? null : encodeProofBinding({ accountID: null, version: '', email })
      if (!account || account.deleted) return null
      if (purpose === 'recovery' && (typeof account.hash !== 'string' || !account.hash || typeof account.salt !== 'string' || !account.salt)) return null
      if (purpose === 'reauth' && (account.id !== dependencies.principal?.id || account.verified !== true || !dependencies.principal.sid)) return null
      return encodeProofBinding({ accountID: account.id, version: dependencies.credentialVersion(account), ...(purpose === 'reauth' ? { sid: dependencies.principal!.sid } : {}) })
    },
    quotaIdentity: proofQuotaIdentity,
    session: (reference, email) => {
      const binding = decodeProofBinding(reference)
      return dependencies.grant({ purpose, email, account: binding.accountID, version: binding.version, ...(binding.sid ? { sid: binding.sid } : {}) })
    },
  })
}
