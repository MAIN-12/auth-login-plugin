import { createHmac } from 'node:crypto'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import type { PayloadRequest } from 'payload'
import { expect, it, vi } from 'vitest'
import { credentialTransaction } from '../src/auth/server/passwordAdapter'
import { isCredentialRequest } from '../src/auth/server/credentialRequest'
import type { DrizzleDatabase } from '../src/auth/server/otpSession'

vi.mock('../src/auth/server/otpSession', async (original) => ({
  ...(await original<typeof import('../src/auth/server/otpSession')>()),
  nativeTransaction: (db: DrizzleDatabase, work: (tx: unknown) => Promise<unknown>) =>
    db.drizzle.transaction(work),
}))

it.each(['sqlite', 'postgres'])(
  'binds credential lock values on the %s native transaction',
  async (name) => {
    const tx = {}
    const execute = vi.fn(async () => undefined)
    const db = {
      name,
      sessions: {},
      drizzle: { transaction: async (work: (tx: unknown) => Promise<unknown>) => work(tx) },
      execute,
      findOne: vi.fn(async () => null),
    }
    const req = { payload: { db, secret: 'lock-test-secret' } } as unknown as PayloadRequest
    const email = "o'hara@example.test"
    const key = createHmac('sha256', req.payload.secret)
      .update(JSON.stringify(['customers', email]))
      .digest('hex')
    const work = vi.fn(async () => {
      expect(isCredentialRequest(req)).toBe(true)
      expect(Object.keys(db.sessions)).toEqual([req.transactionID])
      return 'committed'
    })
    await expect(credentialTransaction(req, 'customers', email, work)).resolves.toBe('committed')
    const dialect = name === 'postgres' ? new PgDialect() : new SQLiteSyncDialect()
    const calls = execute.mock.calls as unknown as [Parameters<DrizzleDatabase['execute']>[0]][]
    expect(calls[0][0].raw).toContain('CREATE TABLE IF NOT EXISTS')
    const queries = calls.slice(1).map(([args]) => {
      expect(args.db).toBe(tx)
      expect(args.raw).toBeUndefined()
      const query = dialect.sqlToQuery(args.sql!)
      expect(query.params).toEqual([key])
      expect(query.sql).not.toContain(key)
      return query.sql
    })
    expect(queries[0]).toContain(name === 'postgres' ? 'VALUES ($1)' : 'VALUES (?)')
    expect(queries).toHaveLength(name === 'postgres' ? 2 : 1)
    if (name === 'postgres') expect(queries[1]).toContain('WHERE key = $1 FOR UPDATE')
    expect(db.sessions).toEqual({})
    expect(req.transactionID).toBeUndefined()
    expect(isCredentialRequest(req)).toBe(false)
    const failure = new Error('asynchronous credential failure')
    await expect(
      credentialTransaction(req, 'customers', email, async () => {
        await Promise.resolve()
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(db.sessions).toEqual({})
    expect(req.transactionID).toBeUndefined()
    expect(isCredentialRequest(req)).toBe(false)
  },
)
