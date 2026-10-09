import type { PayloadRequest } from 'payload'
import { AuthFailure } from '../contracts/errors'
import type { PasswordPermit } from '../domain/passwordPermit'
import { credentialVersion } from './credentialRequest'
type User = NonNullable<PayloadRequest['user']>
interface Evidence {
  collection: string
  original: User
  id: string | number
  email: string
  sid: string
  hash: string
  salt: string
  version: string
  rehashOpen: boolean
}
const evidence = new WeakMap<PayloadRequest, Evidence>()
export function beginReauthenticationEvidence(
  req: PayloadRequest,
  collection: string,
  original: User,
  record: User,
) {
  if (evidence.has(req)) throw new AuthFailure('AUTH_FAILED', 401)
  evidence.set(req, {
    collection,
    original,
    id: original.id,
    email: String(original.email),
    sid: String(original._sid),
    hash: String(record.hash),
    salt: String(record.salt),
    version: credentialVersion(req.payload.secret, record),
    rehashOpen: true,
  })
}
export function clearReauthenticationEvidence(req: PayloadRequest) {
  evidence.delete(req)
}
/** Payload's conditional, hash-only legacy upgrade precedes login hooks. Track only that native shape. */
export function observeNativeRehash(
  req: PayloadRequest | undefined,
  collection: string,
  data: Record<string, unknown>,
  where: unknown,
) {
  const selected = req ? evidence.get(req) : undefined
  const condition = where as
    | { id?: { equals?: unknown }; hash?: { equals?: unknown }; salt?: { equals?: unknown } }
    | undefined
  if (
    !selected ||
    !selected.rehashOpen ||
    collection !== selected.collection ||
    Object.keys(data).some((key) => !['hash', 'salt'].includes(key)) ||
    typeof data.hash !== 'string' ||
    !data.hash ||
    typeof data.salt !== 'string' ||
    !data.salt ||
    condition?.id?.equals !== selected.id ||
    condition.hash?.equals !== selected.hash ||
    condition.salt?.equals !== selected.salt
  )
    return
  selected.version = credentialVersion(req!.payload.secret, {
    id: selected.id,
    email: selected.email,
    hash: data.hash,
    salt: data.salt,
    _verified: true,
  })
  selected.hash = data.hash
  selected.salt = data.salt
}
/** Native rehash finishes before the first beforeLogin hook; hooks cannot authorize another upgrade. */
export function sealReauthenticationEvidence(req: PayloadRequest) {
  const selected = evidence.get(req)
  if (!selected) throw new AuthFailure('AUTH_FAILED', 401)
  selected.rehashOpen = false
}
/** Final native afterOperation guard runs before Payload commits its own login transaction. */
export async function readReauthenticationProof(
  req: PayloadRequest,
  resultUser: Record<string, unknown> | undefined,
): Promise<PasswordPermit> {
  const selected = evidence.get(req)
  if (
    !selected ||
    !req.transactionID ||
    resultUser?.id !== selected.id ||
    resultUser.email !== selected.email ||
    selected.original.id !== selected.id ||
    selected.original.collection !== selected.collection ||
    selected.original._sid !== selected.sid
  )
    throw new AuthFailure('AUTH_FAILED', 401)
  const record = await req.payload.db.findOne<User>({
    collection: selected.collection,
    req,
    where: { id: { equals: selected.id } },
  })
  if (
    !record ||
    record.email !== selected.email ||
    record._verified !== true ||
    record.deletedAt ||
    credentialVersion(req.payload.secret, record) !== selected.version ||
    !(record.sessions as { id: string; expiresAt: string | Date }[] | undefined)?.some(
      (session) =>
        session.id === selected.sid && new Date(session.expiresAt).getTime() > Date.now(),
    )
  )
    throw new AuthFailure('AUTH_FAILED', 401)
  return {
    purpose: 'reauth',
    email: selected.email,
    account: selected.id,
    version: selected.version,
    sid: selected.sid,
  }
}

interface HeldTransaction {
  release: () => void
  reject: (error: unknown) => void
  done: Promise<unknown>
}
const transactions = new WeakMap<PayloadRequest, HeldTransaction>()
/** SQLite native auth may not open a transaction. Its verified session write opens
 * a borrowed transaction, held until native hooks and final evidence checks finish.
 * Password/lockout work runs before this point and is never replayed. */
export function holdReauthenticationTransaction<T>(
  req: PayloadRequest,
  transaction: (publish: (value: T) => void, finished: Promise<void>) => Promise<T>,
): Promise<T> {
  if (transactions.has(req)) throw new AuthFailure('AUTH_FAILED', 401)
  let publish!: (value: T) => void
  let fail!: (error: unknown) => void
  let release!: () => void
  let reject!: (error: unknown) => void
  const reply = new Promise<T>((resolve, rejection) => {
    publish = resolve
    fail = rejection
  })
  const finished = new Promise<void>((resolve, rejection) => {
    release = resolve
    reject = rejection
  })
  // Acquisition may fail before the callback starts waiting for release.
  void finished.catch(() => {})
  const done = transaction(publish, finished)
  // Handle acquisition/perform errors before native login receives its session-write result.
  void done.catch(fail)
  transactions.set(req, { release, reject, done })
  return reply
}
export async function settleReauthenticationTransaction(req: PayloadRequest, error?: unknown) {
  const held = transactions.get(req)
  if (!held) return
  try {
    if (error === undefined) held.release()
    else held.reject(error)
    await held.done
  } finally {
    transactions.delete(req)
  }
}
