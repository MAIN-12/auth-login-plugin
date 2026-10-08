import { z } from 'zod'
import { AuthOperationFailure } from './errors'
const proofBindingSchema = z.strictObject({
  accountID: z.union([z.string(), z.number(), z.null()]),
  version: z.string(),
  email: z.string().optional(),
  sid: z.string().optional(),
})
export type ProofBinding = z.infer<typeof proofBindingSchema>
/** Named, authenticated durable OTP reference, never a public account-discovery response. */
export function encodeProofBinding(binding: ProofBinding): string {
  return JSON.stringify(binding)
}
export function decodeProofBinding(reference: string | number): ProofBinding {
  try {
    return proofBindingSchema.parse(JSON.parse(String(reference)))
  } catch {
    throw new AuthOperationFailure('AUTH_FAILED')
  }
}
export function proofQuotaIdentity(reference: string | number): string | number {
  const binding = decodeProofBinding(reference)
  if (binding.accountID !== null) return binding.accountID
  if (binding.email) return binding.email
  throw new AuthOperationFailure('AUTH_FAILED')
}
