import { AuthFailure } from '../domain/login'
import { createHmac } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import type { DrizzleDatabase } from './otpSession'
export const cutoverTable = 'auth_login_cutovers'
export const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`
/** Private durable state: no collection CRUD surface; missing state is baseline, not a read-error fallback. */
export async function readCutoverGeneration(req: PayloadRequest, collection: string): Promise<string> {
  try {
    const db = req.payload.db as unknown as DrizzleDatabase
    if (!['sqlite', 'postgres'].includes(db.name)) throw new Error('AUTH_STORAGE_UNAVAILABLE')
    const connection = req.transactionID ? db.sessions[String(await req.transactionID)]?.db : db.drizzle
    if (!connection) throw new Error('AUTH_STORAGE_UNAVAILABLE')
    await db.execute({ db: connection, raw: `CREATE TABLE IF NOT EXISTS ${cutoverTable} (collection TEXT PRIMARY KEY, generation TEXT NOT NULL)` })
    const result = await db.execute({ db: connection, raw: `SELECT generation FROM ${cutoverTable} WHERE collection=${sqlLiteral(collection)}` }) as { rows: { generation: string }[] }
    const generation = result.rows[0]?.generation ?? ''
    if (result.rows.length && !/^[a-f0-9]{64}$/.test(generation)) throw new Error('AUTH_STORAGE_UNAVAILABLE')
    return generation
  } catch {
    // Native schema/query availability precedes the OTP flow's own storage boundary.
    // Never downgrade infrastructure failure to invalid credentials or a baseline epoch.
    throw new AuthFailure('AUTH_UNAVAILABLE', 503)
  }
}
export async function methodPermitSecret(req: PayloadRequest, collection: string): Promise<string> {
  const generation = await readCutoverGeneration(req, collection)
  return generation ? createHmac('sha256', req.payload.secret).update(JSON.stringify(['auth-login/cutover/permit/v1', collection, generation])).digest('hex') : req.payload.secret
}
