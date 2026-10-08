import type { PayloadRequest } from 'payload'
import { AuthOperationFailure } from '../../domain/errors'
import type { OwnCapabilities } from '../../application/ports/session'
import type { CredentialCapabilities } from '../../domain/credentials'

/** Privileged native storage read scoped exclusively to an authenticated principal.
 * Hash/salt remain in this adapter and are reduced to non-secret evidence.
 */
export async function readCredentialCapabilities(
  req: PayloadRequest,
  collection: string,
): Promise<CredentialCapabilities> {
  if (
    !req.user ||
    req.user.collection !== collection ||
    !(
      (typeof req.user.id === 'string' && req.user.id.length > 0) ||
      (typeof req.user.id === 'number' && Number.isFinite(req.user.id))
    )
  )
    throw new AuthOperationFailure('UNAUTHENTICATED')
  const principal = req.user
  const id = principal.id
  const record = (await req.payload.db.findOne({
    collection,
    req,
    where: { id: { equals: id } },
    select: { hash: true, salt: true, _verified: true },
  })) as { hash?: unknown; salt?: unknown; _verified?: unknown } | null
  if (req.user !== principal || req.user.id !== id || req.user.collection !== collection)
    throw new AuthOperationFailure('UNAUTHENTICATED')
  if (!record) return { password: 'unknown', emailVerification: 'unknown' }
  const password =
    typeof record.hash === 'string' &&
    record.hash.length > 0 &&
    typeof record.salt === 'string' &&
    record.salt.length > 0
      ? 'available'
      : record.hash === null && record.salt === null
        ? 'unavailable'
        : 'unknown'
  return {
    password,
    emailVerification:
      record._verified === true
        ? 'verified'
        : record._verified === false
          ? 'unverified'
          : 'unknown',
  }
}

export function createOwnCapabilitiesRepository(req: PayloadRequest, collection: string) {
  const principal = req.user
  const payload = req.payload
  const headers = req.headers
  const id = principal?.id
  let disposed = false
  const port: OwnCapabilities = {
    async readOwn() {
      if (
        disposed ||
        !principal ||
        req.user !== principal ||
        principal.id !== id ||
        principal.collection !== collection ||
        req.payload !== payload ||
        req.headers !== headers
      )
        throw new AuthOperationFailure('UNAUTHENTICATED')
      const value = await readCredentialCapabilities(req, collection)
      if (disposed || req.payload !== payload || req.headers !== headers)
        throw new AuthOperationFailure('UNAUTHENTICATED')
      return value
    },
  }
  return {
    port,
    dispose() {
      disposed = true
    },
  }
}
