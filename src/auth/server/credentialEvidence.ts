import type { PayloadRequest } from 'payload'
import type { CredentialCapabilities } from '../domain/credentials'

/** Privileged native storage read scoped exclusively to an authenticated principal.
 * Hash/salt remain in this adapter and are reduced to non-secret evidence.
 */
export async function readCredentialCapabilities(req: PayloadRequest, collection: string): Promise<CredentialCapabilities> {
  if (!req.user || req.user.collection !== collection) throw new Error('UNAUTHENTICATED')
  const record = await req.payload.db.findOne({ collection, req, where: { id: { equals: req.user.id } }, select: { hash: true, salt: true, _verified: true } }) as { hash?: unknown; salt?: unknown; _verified?: unknown } | null
  if (!record) return { password: 'unknown', emailVerification: 'unknown' }
  const password = typeof record.hash === 'string' && record.hash.length > 0 && typeof record.salt === 'string' && record.salt.length > 0 ? 'available'
    : record.hash == null && record.salt == null ? 'unavailable' : 'unknown'
  return { password, emailVerification: record._verified === true ? 'verified' : record._verified === false ? 'unverified' : 'unknown' }
}
