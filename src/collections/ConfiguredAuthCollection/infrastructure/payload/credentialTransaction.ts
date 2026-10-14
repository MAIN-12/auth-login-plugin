import { createHmac, randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { acquireCredentialLock } from '../../../AuthLoginCredentialLocks/index'
import { AuthFailure } from '../../../../shared/contracts/errors'
import {
  nativeTransaction,
  type DrizzleDatabase,
} from '../../../../shared/infrastructure/payload/nativeTransaction'
import { findNativeAccountByEmail } from '../queries/nativeAccounts'
import { lockUserRow } from '../repositories/userRowLock'
import { credentialRequests } from './credentialRequest'

/** Only one native transaction can finalize credentials, revoke sessions and invalidate permits.
 * Row locks coordinate with native password/OTP session writes; hash-version proofs cannot survive reset.
 */
export async function credentialTransaction<T>(
  req: PayloadRequest,
  collection: string,
  email: string,
  work: () => Promise<T>,
): Promise<T> {
  const db = req.payload.db as unknown as DrizzleDatabase
  if (!['sqlite', 'postgres'].includes(db.name) || req.transactionID)
    throw new AuthFailure('AUTH_UNAVAILABLE', 503)
  const key = createHmac('sha256', req.payload.secret)
    .update(JSON.stringify([collection, email]))
    .digest('hex')
  return nativeTransaction(db, async (tx) => {
    await acquireCredentialLock(db, tx, key)
    const id = randomUUID()
    db.sessions[id] = {
      db: tx,
      reject: async () => {
        throw new AuthFailure('AUTH_FAILED', 401)
      },
      resolve: async () => {
        throw new AuthFailure('AUTH_FAILED', 401)
      },
    }
    req.transactionID = id
    credentialRequests.add(req)
    try {
      const account = await findNativeAccountByEmail(req, collection, email)
      if (account) await lockUserRow(db, tx, collection, account.id)
      return await work()
    } finally {
      credentialRequests.delete(req)
      delete req.transactionID
      delete db.sessions[id]
    }
  })
}
