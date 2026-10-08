import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { createClient, type Config as SQLiteConfig } from '@libsql/client'

import type { OtpStateAccess, OtpStore } from '../infrastructure/payload/otpLedger'
interface SQLResult {
  rows: Array<Record<string, unknown>>
}
interface SQLiteTransaction {
  execute(statement: { sql: string; args: string[] }): Promise<SQLResult>
  commit(): Promise<void>
  rollback(): Promise<void>
  close(): void
}
interface PGConnection {
  query(sql: string, args?: string[]): Promise<SQLResult>
  release(): void
}
interface SecurityDatabase {
  name: string
  clientConfig?: SQLiteConfig
  pool?: { query(sql: string): Promise<unknown>; connect(): Promise<PGConnection> }
}
const table = 'auth_login_otp_security'
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Retry only acquisition: the work callback can send mail and must never be replayed. */
async function acquireSQLite<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work()
    } catch (error) {
      const code = (error as { code?: string }).code
      if (attempt >= 19 || (code !== 'SQLITE_BUSY' && code !== 'SQLITE_LOCKED')) throw error
      await pause(25)
    }
  }
}
const schema = `CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, value TEXT)`

/** No Payload collection exists: public CRUD, GraphQL and Local API cannot expose these records.
 * Database-native transactions/row locks provide coordination across processes, not a JS mutex.
 */
export function createPayloadOtpStore(req: PayloadRequest): OtpStore {
  const db = req.payload.db as unknown as SecurityDatabase
  const key = createHash('sha256')
    .update('auth-login/otp-storage/v1\0')
    .update(req.payload.secret)
    .digest()
  function encrypt(value: Record<string, unknown>, recordKey: string): string {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(Buffer.from(recordKey))
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64')
  }
  function decrypt(value: string, recordKey: string): Record<string, unknown> {
    const bytes = Buffer.from(value, 'base64')
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
    cipher.setAAD(Buffer.from(recordKey))
    cipher.setAuthTag(bytes.subarray(12, 28))
    return JSON.parse(
      Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'),
    ) as Record<string, unknown>
  }
  return {
    async transaction(keys, work) {
      const ordered = [...new Set(keys)].sort()
      if (!ordered.length) throw new Error('OTP_STORAGE_UNAVAILABLE')
      let query: (sql: string, args: string[]) => Promise<SQLResult>
      let commit: () => Promise<void>
      let rollback: () => Promise<void>
      let close: () => void
      let parameter: (position: number) => string
      if (db.name === 'sqlite' && db.clientConfig) {
        const { client, tx } = await acquireSQLite(async () => {
          const client = createClient(db.clientConfig!)
          try {
            await client.execute(schema)
            const tx = (await client.transaction('write')) as unknown as SQLiteTransaction
            return { client, tx }
          } catch (error) {
            client.close()
            throw error
          }
        })
        query = (sql, args) => tx.execute({ sql, args })
        commit = () => tx.commit()
        rollback = () => tx.rollback()
        close = () => {
          tx.close()
          client.close()
        }
        parameter = () => '?'
      } else if (db.name === 'postgres' && db.pool) {
        await db.pool.query(schema)
        const tx = await db.pool.connect()
        try {
          await tx.query('BEGIN')
        } catch (error) {
          tx.release()
          throw error
        }
        query = (sql, args) => tx.query(sql, args)
        commit = async () => {
          await tx.query('COMMIT')
        }
        rollback = async () => {
          await tx.query('ROLLBACK')
        }
        close = () => tx.release()
        parameter = (position) => `$${position}`
      } else throw new Error('OTP_STORAGE_UNAVAILABLE')
      try {
        for (const recordKey of ordered) {
          await query(
            `INSERT INTO ${table} (key, value) VALUES (${parameter(1)}, NULL) ON CONFLICT (key) DO NOTHING`,
            [recordKey],
          )
          if (db.name === 'postgres')
            await query(`SELECT key FROM ${table} WHERE key = $1 FOR UPDATE`, [recordKey])
        }
        const allowed = new Set(ordered)
        const state: OtpStateAccess = {
          async get(recordKey) {
            if (!allowed.has(recordKey)) throw new Error('OTP_UNLOCKED_RECORD')
            const result = await query(`SELECT value FROM ${table} WHERE key = ${parameter(1)}`, [
              recordKey,
            ])
            const value = result.rows[0]?.value
            return typeof value === 'string' ? decrypt(value, recordKey) : undefined
          },
          async put(recordKey, value) {
            if (!allowed.has(recordKey)) throw new Error('OTP_UNLOCKED_RECORD')
            await query(`UPDATE ${table} SET value = ${parameter(1)} WHERE key = ${parameter(2)}`, [
              encrypt(value, recordKey),
              recordKey,
            ])
          },
        }
        const result = await work(state)
        await commit()
        return result
      } catch (error) {
        await rollback()
        throw error
      } finally {
        close()
      }
    },
  }
}
