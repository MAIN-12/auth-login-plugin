import type { Payload, PayloadRequest } from 'payload'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import type { SQL } from 'drizzle-orm'
import { expect, it, vi } from 'vitest'
import { migrateAuthLogin } from '../src/index'
import { isCredentialRequest } from '../src/auth/server/credentialRequest'
import type { DrizzleDatabase } from '../src/auth/server/otpSession'

vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  createLocalReq: async (_options: object, payload: Payload) => ({ payload, context: {} }),
}))
vi.mock('../src/auth/server/otpSession', async (original) => ({
  ...(await original<typeof import('../src/auth/server/otpSession')>()),
  nativeTransaction: (db: DrizzleDatabase, work: (tx: unknown) => Promise<unknown>) =>
    db.drizzle.transaction(work),
}))

function fixture(fail = false, name = 'postgres', collection = 'customers') {
  const dialect = name === 'postgres' ? new PgDialect() : new SQLiteSyncDialect()
  const original = {
    id: 7,
    email: 'owner@example.com',
    hash: 'original-hash',
    salt: 'original-salt',
    password: 'never-written',
    _verified: false,
    googleSub: 'stable-sub',
    sessions: ['old'],
    resetPasswordToken: 'old-reset',
    resetPasswordExpiration: 'old-expiry',
    _verificationToken: 'old-verify',
  }
  let record = structuredClone(original)
  let codes = [{ scope: 'customers' }, { scope: 'staff' }]
  let generation = 'a'.repeat(64)
  const reqs: PayloadRequest[] = []
  const tx = {}
  const db = {
    name,
    sessions: {},
    drizzle: {
      async transaction(work: (tx: object) => Promise<unknown>) {
        const saved = { record: structuredClone(record), codes: structuredClone(codes), generation }
        try {
          return await work(tx)
        } catch (error) {
          record = saved.record
          codes = saved.codes
          generation = saved.generation
          throw error
        }
      },
    },
    execute: vi.fn(async (args: { db: unknown; raw?: string; sql?: SQL }) => {
      const query = args.sql ? dialect.sqlToQuery(args.sql) : undefined
      const text = args.raw ?? query!.sql
      if (text.startsWith('SELECT')) {
        expect(args.raw).toBeUndefined()
        expect(query!.params).toEqual([collection])
        expect(text).not.toContain(collection)
        return { rows: [{ generation }] }
      }
      if (text.startsWith('CREATE')) {
        expect(args.raw).toBe(
          'CREATE TABLE IF NOT EXISTS auth_login_cutovers (collection TEXT PRIMARY KEY, generation TEXT NOT NULL)',
        )
        return { rows: [] }
      }
      if (text.startsWith('INSERT')) {
        expect(args.db).toBe(tx)
        expect(args.raw).toBeUndefined()
        expect(query!.params).toEqual([collection, expect.stringMatching(/^[a-f0-9]{64}$/)])
        expect(text).not.toContain(collection)
        expect(text).not.toContain(query!.params[1])
        generation = query!.params[1] as string
        return { rows: [] }
      }
      throw new Error('Unexpected SQL outside cutover generation')
    }),
    find: vi.fn(
      async ({
        collection: requestedCollection,
        req,
        where,
      }: {
        collection: string
        req: PayloadRequest
        where?: object
      }) => {
        expect(isCredentialRequest(req)).toBe(true)
        expect(Object.keys(db.sessions)).toEqual([req.transactionID])
        reqs.push(req)
        if (requestedCollection === collection) return { docs: [record] }
        expect(where).toEqual({ scope: { equals: 'customers' } })
        return { docs: codes.filter((code) => code.scope === 'customers') }
      },
    ),
    updateOne: vi.fn(
      async ({
        data,
        req,
        returning,
      }: {
        data: typeof record
        req: PayloadRequest
        returning: boolean
      }) => {
        expect(req).toBe(reqs.at(-1))
        expect(returning).toBe(false)
        expect(data).not.toHaveProperty('hash')
        expect(data).not.toHaveProperty('salt')
        expect(data).not.toHaveProperty('password')
        record = { ...record, ...data }
      },
    ),
    deleteMany: vi.fn(async ({ req }: { req: PayloadRequest }) => {
      expect(req).toBe(reqs.at(-1))
      codes = codes.filter((code) => code.scope !== 'customers')
      if (fail) {
        await Promise.resolve()
        throw new Error('native delete failed')
      }
    }),
  }
  const payload = {
    db,
    collections: {
      [collection]: { config: { auth: { useSessions: true, verify: true } } },
      'auth-otps': { config: {} },
    },
    update: vi.fn(),
    create: vi.fn(),
  } as unknown as Payload
  const options = {
    collection,
    maintenance: true as const,
    legacyOtpCollection: { slug: 'auth-otps', where: { scope: { equals: 'customers' } } },
  }
  return {
    payload,
    db,
    options,
    original,
    reqs,
    state: () => ({ record, codes, generation }),
  }
}
it('public maintenance preserves native credentials/mapping without quota-table writes, revokes only inventory and chooses fresh generations', async () => {
  const f = fixture()
  const first = await migrateAuthLogin(f.payload, f.options)
  expect(first).toEqual({
    success: true,
    collection: 'customers',
    accounts: 1,
    legacyCodesDeleted: 1,
    generation: expect.stringMatching(/^[a-f0-9]{64}$/),
  })
  expect(f.state().record).toEqual({
    ...f.original,
    sessions: [],
    resetPasswordToken: null,
    resetPasswordExpiration: null,
    _verificationToken: null,
  })
  expect(f.state().codes).toEqual([{ scope: 'staff' }])
  const second = await migrateAuthLogin(f.payload, f.options)
  expect(second.generation).not.toBe(first.generation)
  expect(f.payload.create).not.toHaveBeenCalled()
  expect(f.payload.update).not.toHaveBeenCalled()
  expect(f.db.sessions).toEqual({})
  for (const req of f.reqs) {
    expect(req.transactionID).toBeUndefined()
    expect(isCredentialRequest(req)).toBe(false)
  }
})
it('public maintenance preserves the associated rollback and cleans request markers after async native failure', async () => {
  const f = fixture(true)
  await expect(migrateAuthLogin(f.payload, f.options)).rejects.toThrow('native delete failed')
  expect(f.state()).toEqual({
    record: f.original,
    codes: [{ scope: 'customers' }, { scope: 'staff' }],
    generation: 'a'.repeat(64),
  })
  expect(f.db.sessions).toEqual({})
  expect(f.db.updateOne).toHaveBeenCalledTimes(1)
  for (const req of f.reqs) {
    expect(req.transactionID).toBeUndefined()
    expect(isCredentialRequest(req)).toBe(false)
  }
})
it('maintenance refuses invalid inventory and unsupported native collections before any writes', async () => {
  const f = fixture()
  for (const options of [
    { ...f.options, maintenance: false as true },
    { ...f.options, legacyOtpCollection: { slug: 'customers', where: {} } },
    { ...f.options, legacyOtpCollection: { slug: 'missing', where: {} } },
    { ...f.options, collection: 'missing' },
  ])
    await expect(migrateAuthLogin(f.payload, options)).rejects.toThrow('auth-login:')
  expect(f.db.find).not.toHaveBeenCalled()
  expect(f.db.execute).not.toHaveBeenCalled()
})

it.each(['sqlite', 'postgres'])(
  'binds adversarial cutover collection and fresh generation on %s without SQL interpolation',
  async (name) => {
    const collection = "customers'; DROP TABLE auth_login_cutovers; --"
    const f = fixture(false, name, collection)
    const result = await migrateAuthLogin(f.payload, f.options)
    expect(result.collection).toBe(collection)
    expect(result.generation).toMatch(/^[a-f0-9]{64}$/)
    expect(f.state().generation).toBe(result.generation)
    expect(f.db.sessions).toEqual({})
  },
)
