import type { PayloadRequest } from 'payload'
type NativeUser = NonNullable<PayloadRequest['user']>

/** Password writes deliberately use Local API: hashing and configured change hooks must run. */
export function createVerifiedPasswordAccount(
  req: PayloadRequest,
  collection: string,
  email: string | undefined,
  password: string,
) {
  return req.payload.create({
    collection,
    req,
    overrideAccess: true,
    disableVerificationEmail: true,
    data: { email, password, _verified: true },
  })
}
export function updateAccountPassword(
  req: PayloadRequest,
  collection: string,
  id: string | number,
  password: string,
  verifyEmail = false,
) {
  return req.payload.update({
    collection,
    id,
    req,
    overrideAccess: true,
    data: { password, ...(verifyEmail ? { _verified: true } : {}) },
  })
}
export function verifyAccountEmail(req: PayloadRequest, collection: string, id: string | number) {
  return req.payload.update({
    collection,
    id,
    req,
    overrideAccess: true,
    data: { _verified: true },
  })
}
/** Native session write must not rehash a password or re-run change/provisioning hooks.
 * The caller holds the configured auth collection transaction/row lock.
 */
export function persistNativeSessions(
  req: PayloadRequest,
  collection: string,
  id: string | number,
  snapshot: Record<string, unknown> | null,
  sessions: NativeUser['sessions'],
  extras: Record<string, unknown> = {},
) {
  return req.payload.db.updateOne({
    collection,
    id,
    req,
    data: { ...snapshot, sessions, ...extras },
    returning: false,
  })
}
/** A provider-only account is provisioned through host hooks, then has no password material.
 * Clearing uses native storage: hashing a null value through Local API is not equivalent.
 */
export function clearProviderAccountPassword(
  req: PayloadRequest,
  collection: string,
  account: NativeUser,
) {
  return req.payload.db.updateOne({
    collection,
    id: account.id,
    req,
    data: { ...account, hash: null, salt: null },
    returning: false,
  })
}
