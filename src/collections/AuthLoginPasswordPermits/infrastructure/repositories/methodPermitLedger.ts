import { createHmac } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { AuthFailure } from '../../../../shared/contracts/errors'
import type { PasswordPermit } from '../../domain/passwordPermit'
import type { DrizzleDatabase } from '../../../../shared/infrastructure/payload/nativeTransaction'

/** Consume only inside the caller-owned native credential transaction; never commit here. */
export async function consumeMethodPermit(
  req: PayloadRequest,
  permit: PasswordPermit,
  now: () => number = Date.now,
) {
  const db = req.payload.db as unknown as DrizzleDatabase
  const transaction = req.transactionID ? db.sessions[String(await req.transactionID)] : undefined
  if (!transaction?.db || !permit.nonce || !permit.expiresAt || permit.expiresAt <= now())
    throw new AuthFailure('AUTH_FAILED', 401)
  const key = createHmac('sha256', req.payload.secret).update(permit.nonce).digest('hex')
  // Strict create keeps the unique nonce authoritative: replay must reject, not upsert.
  await req.payload.db.create({
    collection: 'auth-login-password-permits',
    data: { key, expires_at: permit.expiresAt },
    req,
    returning: false,
  })
}
