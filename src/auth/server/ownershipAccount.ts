import type { PayloadRequest } from 'payload'
import type { OwnershipAccount } from '../application/ports/ownership'
import { credentialVersion } from './credentialRequest'
export interface LegacyOwnershipAccount {
  id: string | number
  email: string
  hash?: unknown
  salt?: unknown
  verified?: unknown
  deleted?: unknown
}
/** Selected evidence only: native credentials stop at this server mapper. */
export function mapOwnershipAccount(
  account: LegacyOwnershipAccount,
  version: string,
): OwnershipAccount {
  const known =
    ((typeof account.id === 'string' && !!account.id) ||
      (typeof account.id === 'number' && Number.isFinite(account.id))) &&
    typeof account.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) &&
    account.email === account.email.trim().toLowerCase() &&
    !!version
  return {
    id: account.id,
    email: account.email,
    version,
    state: !known ? 'unknown' : account.deleted ? 'deleted' : 'active',
    password:
      typeof account.hash === 'string' &&
      account.hash &&
      typeof account.salt === 'string' &&
      account.salt
        ? 'available'
        : account.hash == null && account.salt == null
          ? 'unavailable'
          : 'unknown',
    emailVerification:
      account.verified === true
        ? 'verified'
        : account.verified === false
          ? 'unverified'
          : 'unknown',
  }
}
export async function findOwnershipAccount(
  req: PayloadRequest,
  collection: string,
  email: string,
): Promise<OwnershipAccount | null> {
  const account = await req.payload.db.findOne<NonNullable<PayloadRequest['user']>>({
    collection,
    req,
    where: { email: { equals: email } },
    select: { id: true, email: true, hash: true, salt: true, _verified: true, deletedAt: true },
  })
  return account
    ? mapOwnershipAccount(
        {
          id: account.id,
          email: String(account.email),
          hash: account.hash,
          salt: account.salt,
          verified: account._verified,
          deleted: account.deletedAt,
        },
        credentialVersion(req.payload.secret, account),
      )
    : null
}
