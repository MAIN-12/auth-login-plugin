import { expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { PayloadRequest } from 'payload'
import { acquireCredentialLock } from '../src/collections/AuthLoginCredentialLocks'
import { readCutoverGeneration } from '../src/collections/AuthLoginCutovers'
import { consumeMethodPermit } from '../src/collections/AuthLoginPasswordPermits'
import type { DrizzleDatabase } from '../src/shared/infrastructure/payload/nativeTransaction'

function database(name = 'postgres') {
  const tx = {}
  const statements: { sql: string; params: unknown[] }[] = []
  const execute = vi.fn(async (args: Parameters<DrizzleDatabase['execute']>[0]) => {
    expect(args.db).toBe(tx)
    const { sql, params } = new PgDialect().sqlToQuery(args.sql!)
    statements.push({ sql, params })
  })
  const db = { name, execute, sessions: { active: { db: tx } } } as unknown as DrizzleDatabase
  return { db, tx, statements }
}
it('credential locking inserts conflict-safe keys before acquiring a PostgreSQL row lock', async () => {
  const f = database()
  await acquireCredentialLock(f.db, f.tx, "bound'key")
  expect(f.statements.map((row) => row.sql)).toEqual([
    'INSERT INTO auth_login_credential_locks (key) VALUES ($1) ON CONFLICT (key) DO NOTHING',
    'SELECT key FROM auth_login_credential_locks WHERE key = $1 FOR UPDATE',
  ])
  expect(f.statements.map((row) => row.params)).toEqual([["bound'key"], ["bound'key"]])
})
it('SQLite credential locking relies on the caller native write transaction, never FOR UPDATE', async () => {
  const f = database('sqlite')
  await acquireCredentialLock(f.db, f.tx, 'key')
  expect(f.statements).toHaveLength(1)
})
it('permit consumption uses Payload strict create with the caller transaction and rejects replay', async () => {
  const f = database()
  const create = vi.fn().mockResolvedValue(null)
  const req = {
    transactionID: Promise.resolve('active'),
    payload: { db: { ...f.db, create }, secret: 'secret' },
  } as unknown as PayloadRequest
  const permit = { nonce: 'unpredictable', expiresAt: 2000 } as Parameters<
    typeof consumeMethodPermit
  >[1]
  await consumeMethodPermit(req, permit, () => 1000)
  expect(create).toHaveBeenCalledExactlyOnceWith({
    collection: 'auth-login-password-permits',
    data: { key: expect.stringMatching(/^[a-f0-9]{64}$/), expires_at: 2000 },
    req,
    returning: false,
  })
  const collision = new Error('nonce must be unique')
  create.mockRejectedValueOnce(collision)
  await expect(consumeMethodPermit(req, permit, () => 1000)).rejects.toBe(collision)
  for (const transactionID of [undefined, 'missing']) {
    await expect(
      consumeMethodPermit({ ...req, transactionID } as PayloadRequest, permit, () => 1000),
    ).rejects.toThrow('AUTH_FAILED')
  }
  const missingConnection = {
    ...req,
    payload: { ...req.payload, db: { ...req.payload.db, sessions: { active: {} } } },
  } as unknown as PayloadRequest
  await expect(consumeMethodPermit(missingConnection, permit, () => 1000)).rejects.toThrow(
    'AUTH_FAILED',
  )
  await expect(consumeMethodPermit(req, permit, () => 2000)).rejects.toThrow('AUTH_FAILED')
  expect(create).toHaveBeenCalledTimes(2)
  expect(f.statements).toHaveLength(0)
})

it('cutover reads use the Payload db API, preserving caller request and missing baseline', async () => {
  const f = database()
  const findOne = vi.fn().mockResolvedValue({ id: 1, generation: 'a'.repeat(64) })
  const req = {
    transactionID: Promise.resolve('active'),
    payload: { db: { ...f.db, findOne } },
  } as unknown as PayloadRequest
  expect(await readCutoverGeneration(req, "customers'quoted")).toBe('a'.repeat(64))
  expect(findOne).toHaveBeenCalledExactlyOnceWith({
    collection: 'auth-login-cutovers',
    req,
    select: { generation: true },
    where: { collection: { equals: "customers'quoted" } },
  })
  findOne.mockResolvedValueOnce(null)
  expect(await readCutoverGeneration({ ...req, transactionID: undefined }, 'customers')).toBe('')
  expect(f.statements).toHaveLength(0)
})

it('cutover read failures, malformed generations and stale transactions fail closed', async () => {
  const f = database()
  const findOne = vi.fn().mockResolvedValue({ id: 1, generation: 'invalid' })
  const req = { payload: { db: { ...f.db, findOne } } } as unknown as PayloadRequest
  for (const generation of ['invalid', '', undefined]) {
    findOne.mockResolvedValueOnce({ id: 1, generation })
    await expect(readCutoverGeneration(req, 'customers')).rejects.toMatchObject({
      message: 'AUTH_UNAVAILABLE',
      status: 503,
    })
  }
  findOne.mockRejectedValueOnce(new Error('storage offline'))
  await expect(readCutoverGeneration(req, 'customers')).rejects.toThrow('AUTH_UNAVAILABLE')
  await expect(
    readCutoverGeneration({ ...req, transactionID: Promise.resolve('missing') }, 'customers'),
  ).rejects.toThrow('AUTH_UNAVAILABLE')
  expect(findOne).toHaveBeenCalledTimes(4)
})
