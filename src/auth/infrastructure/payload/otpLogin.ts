import {
  clearAuthenticationEvidence,
  getAuthenticationEvidence,
  setAuthenticationEvidence,
} from '../../server/adminPolicy'
import type { PayloadRequest } from 'payload'
import type { Principal } from '../../application/models'
import { AuthOperationFailure } from '../../domain/errors'
import {
  decodeProofBinding,
  encodeProofBinding,
  proofQuotaIdentity,
} from '../../domain/proofBinding'
import { credentialVersion } from '../../server/credentialRequest'
import { readCutoverGeneration } from '../../server/cutoverGeneration'
import { createOtpSession } from '../../server/otpSession'

/** Selected evidence is explicit: omitted verification is never a verified account. */
export function selectOtpEvidence(record: Record<string, unknown> | null) {
  if (
    !record ||
    !(
      (typeof record.id === 'string' && record.id.trim().length > 0) ||
      (typeof record.id === 'number' && Number.isFinite(record.id))
    ) ||
    typeof record.email !== 'string' ||
    record.email.length > 254 ||
    record.email !== record.email.trim().toLowerCase() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)
  )
    return { state: 'unknown' as const }
  if (record.deletedAt) return { state: 'deleted' as const, accountID: record.id }
  if (record._verified !== true) return { state: 'unverified' as const, accountID: record.id }
  return { state: 'verified' as const, accountID: record.id, email: record.email }
}
export function createNativeOtpLogin(
  req: PayloadRequest,
  collection: string,
  generation: string,
  assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>,
) {
  let receipt: Awaited<ReturnType<typeof createOtpSession>> | undefined
  const findAccount = async (email: string) => {
    const record = await req.payload.db.findOne({
      collection,
      req,
      where: { email: { equals: email } },
    })
    const evidence = selectOtpEvidence(record)
    return evidence.state === 'verified' && evidence.email === email
      ? encodeProofBinding({
          accountID: evidence.accountID,
          version: credentialVersion(req.payload.secret, record),
        })
      : null
  }
  return {
    findAccount,
    quotaIdentity: proofQuotaIdentity,
    async session(reference: string | number, email: string): Promise<Principal> {
      receipt = undefined
      const binding = decodeProofBinding(reference)
      if (binding.accountID === null) throw new AuthOperationFailure('AUTH_FAILED')
      const originalUser = req.user
      const originalEvidence = getAuthenticationEvidence(req)
      try {
        receipt = await createOtpSession(
          req,
          binding.accountID,
          collection,
          email,
          binding.version,
          { method: 'otp' },
          assertOriginalAdminDenied,
          async () => {
            if ((await readCutoverGeneration(req, collection)) !== generation)
              throw new AuthOperationFailure('AUTH_FAILED')
          },
        )
      } finally {
        req.user = originalUser
        clearAuthenticationEvidence(req)
        if (originalEvidence) setAuthenticationEvidence(req, originalEvidence)
      }
      return { accountID: binding.accountID, collection }
    },
    takeReceipt() {
      const result = receipt
      receipt = undefined
      if (!result) throw new AuthOperationFailure('AUTH_UNAVAILABLE')
      return result
    },
    dispose() {
      receipt = undefined
    },
  }
}
