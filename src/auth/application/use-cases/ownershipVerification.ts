import { createOtpProtocol } from './otpProtocol'
import type { OtpProtocolDependencies } from '../ports/otp'
import type { OwnershipAccount, OwnershipPrincipal, OwnershipProof } from '../ports/ownership'
import {
  decodeProofBinding,
  encodeProofBinding,
  proofQuotaIdentity,
} from '../../domain/proofBinding'
/** Ownership eligibility is an application rule with explicit native account/evidence dependencies. */
export function createOwnershipVerification<T>(
  dependencies: Omit<
    OtpProtocolDependencies<T>,
    'findAccount' | 'session' | 'quotaIdentity' | 'purpose'
  > & {
    purpose: OwnershipProof['purpose']
    findOwnershipAccount: (email: string) => Promise<OwnershipAccount | null>
    principal: OwnershipPrincipal | null
    grant: (permit: OwnershipProof) => Promise<T>
  },
) {
  const { purpose } = dependencies
  return createOtpProtocol({
    ...dependencies,
    purpose,
    findAccount: async (email) => {
      const account = await dependencies.findOwnershipAccount(email)
      if (account && (account.email !== email || !account.version)) return null
      if (purpose === 'signup')
        return account ? null : encodeProofBinding({ accountID: null, version: '', email })
      if (
        !account ||
        account.state !== 'active' ||
        (purpose === 'verify-email' && account.emailVerification === 'verified')
      )
        return null
      if (purpose === 'recovery' && account.password !== 'available') return null
      if (
        purpose === 'reauth' &&
        (account.id !== dependencies.principal?.id ||
          account.emailVerification !== 'verified' ||
          !dependencies.principal.sid)
      )
        return null
      return encodeProofBinding({
        accountID: account.id,
        version: account.version,
        ...(purpose === 'reauth' ? { sid: dependencies.principal!.sid } : {}),
      })
    },
    quotaIdentity: proofQuotaIdentity,
    session: (reference, email) => {
      const binding = decodeProofBinding(reference)
      return dependencies.grant({
        purpose,
        email,
        account: binding.accountID,
        version: binding.version,
        ...(binding.sid ? { sid: binding.sid } : {}),
      })
    },
  })
}
