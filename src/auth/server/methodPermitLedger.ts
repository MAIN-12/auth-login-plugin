import { sql } from 'drizzle-orm'
import { createHmac } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { AuthFailure } from '../domain/login'
import type { PasswordPermit } from '../domain/passwordLifecycle'
import type { DrizzleDatabase } from './otpSession'

export async function initializeMethodPermitLedger(req: PayloadRequest) {
  const db = req.payload.db as unknown as DrizzleDatabase
  await db.execute({
    db: db.drizzle,
    raw: 'CREATE TABLE IF NOT EXISTS auth_login_password_permits (key TEXT PRIMARY KEY, expires_at BIGINT NOT NULL)',
  })
}
/** Consume only inside the caller-owned native credential transaction; never commit here. */
export async function consumeMethodPermit(
  req: PayloadRequest,
  permit: PasswordPermit,
  now: () => number = Date.now,
) {
  const db = req.payload.db as unknown as DrizzleDatabase
  const transaction = req.transactionID ? db.sessions[String(await req.transactionID)] : undefined
  if (!transaction || !permit.nonce || !permit.expiresAt || permit.expiresAt <= now())
    throw new AuthFailure('AUTH_FAILED', 401)
  const key = createHmac('sha256', req.payload.secret).update(permit.nonce).digest('hex')
  await db.execute({
    db: transaction.db,
    sql: sql`INSERT INTO auth_login_password_permits (key, expires_at) VALUES (${key}, ${permit.expiresAt})`,
  })
}
