import { createHmac } from 'node:crypto'
import type { PayloadRequest } from 'payload'
/** Server-only capability. HTTP data/context cannot authorize credential or full session writes. */
export const reauthenticationRequests = new WeakSet<PayloadRequest>()
export const isReauthenticationRequest = (req: PayloadRequest): boolean =>
  reauthenticationRequests.has(req)
export const credentialRequests = new WeakSet<PayloadRequest>()
export const isCredentialRequest = (req: PayloadRequest): boolean => credentialRequests.has(req)

export function credentialVersion(secret: string, record: Record<string, unknown> | null): string {
  return createHmac('sha256', secret)
    .update('auth-login/credential/v1:')
    .update(
      JSON.stringify([record?.id, record?.email, record?.hash, record?.salt, record?._verified]),
    )
    .digest('hex')
}
