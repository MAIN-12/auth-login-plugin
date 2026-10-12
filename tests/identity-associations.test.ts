import { expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { PayloadRequest } from 'payload'
import {
  findIdentityAccount,
  insertIdentityAssociation,
  associateIdentityIfAbsent,
} from '../src/collections/AuthLoginIdentities'
import type { DrizzleDatabase } from '../src/shared/infrastructure/payload/nativeTransaction'

function fixture() {
  const tx = {}
  const identities = new Map<string, string>()
  const queries: { sql: string; params: unknown[] }[] = []
  const create = vi.fn(
    async (args: {
      collection: string
      data: { collection: string; provider: string; subject: string; account: string }
      req: PayloadRequest
      returning: boolean
    }) => {
      expect(args.collection).toBe('auth-login-identities')
      expect(args.req.transactionID).toBe('transaction')
      expect(args.returning).toBe(false)
      const key = JSON.stringify([args.data.collection, args.data.provider, args.data.subject])
      if (identities.has(key)) throw new Error('identity must be unique')
      for (const [storedKey, storedAccount] of identities) {
        const [collection, provider] = JSON.parse(storedKey)
        if (
          collection === args.data.collection &&
          provider === args.data.provider &&
          storedAccount === args.data.account
        )
          throw new Error('account/provider must be unique')
      }
      identities.set(key, args.data.account)
      return null
    },
  )
  const db = {
    create,
    sessions: { transaction: { db: tx } },
    execute: vi.fn(async (args: Parameters<DrizzleDatabase['execute']>[0]) => {
      const query = new PgDialect().sqlToQuery(args.sql!)
      queries.push(query)
      const key = JSON.stringify(query.params.slice(0, 3))
      expect(args.db).toBe(tx)
      if (!identities.has(key)) identities.set(key, String(query.params[3]))
      return { rows: [] }
    }),
  } as unknown as DrizzleDatabase
  const find = vi.fn(
    async (args: {
      req: PayloadRequest
      where: { and: Record<string, { equals: string }>[] }
      overrideAccess: boolean
      depth: number
    }) => {
      expect(args.overrideAccess).toBe(true)
      expect(args.depth).toBe(0)
      const key = JSON.stringify(args.where.and.map((part) => Object.values(part)[0].equals))
      return { docs: identities.has(key) ? [{ account: identities.get(key) }] : [] }
    },
  )
  const req = { transactionID: 'transaction', payload: { db, find } } as unknown as PayloadRequest
  return { db, req, queries, find, create }
}

it('isolates identical provider subjects and collections using bound provider values', async () => {
  const f = fixture()
  await insertIdentityAssociation(f.req, 'customers', 'google', "subject'quoted", 'google-user')
  await insertIdentityAssociation(f.req, 'customers', 'github', "subject'quoted", 'github-user')
  await insertIdentityAssociation(f.req, 'staff', 'google', "subject'quoted", 'staff-user')
  const req = { payload: f.req.payload } as PayloadRequest
  expect(await findIdentityAccount(req, 'customers', 'google', "subject'quoted")).toBe(
    'google-user',
  )
  expect(await findIdentityAccount(req, 'customers', 'github', "subject'quoted")).toBe(
    'github-user',
  )
  expect(await findIdentityAccount(req, 'staff', 'google', "subject'quoted")).toBe('staff-user')
  expect(await findIdentityAccount(req, 'customers', 'microsoft', "subject'quoted")).toBeUndefined()
  expect(f.create).toHaveBeenCalledTimes(3)
  expect(f.queries).toHaveLength(0)
  expect(f.create.mock.calls.map(([args]) => args.data)).toEqual([
    {
      collection: 'customers',
      provider: 'google',
      subject: "subject'quoted",
      account: 'google-user',
    },
    {
      collection: 'customers',
      provider: 'github',
      subject: "subject'quoted",
      account: 'github-user',
    },
    { collection: 'staff', provider: 'google', subject: "subject'quoted", account: 'staff-user' },
  ])
})

it('arbitrates duplicate associations only within the collection/provider/subject key', async () => {
  const f = fixture()
  await associateIdentityIfAbsent(f.req, 'customers', 'google', 'subject', 'first', f.db)
  await associateIdentityIfAbsent(f.req, 'customers', 'google', 'subject', 'rival', f.db)
  expect(
    f.queries.every(({ sql }) =>
      sql.endsWith('ON CONFLICT (collection, provider, subject) DO NOTHING'),
    ),
  ).toBe(true)
  expect(
    await findIdentityAccount(
      { payload: f.req.payload } as PayloadRequest,
      'customers',
      'google',
      'subject',
    ),
  ).toBe('first')
})

it('strict Payload identity creates reject both unique keys and require an active caller transaction', async () => {
  const f = fixture()
  await insertIdentityAssociation(f.req, 'customers', 'google', 'subject', 'first')
  await expect(
    insertIdentityAssociation(f.req, 'customers', 'google', 'subject', 'rival'),
  ).rejects.toThrow('identity must be unique')
  await expect(
    insertIdentityAssociation(f.req, 'customers', 'google', 'another', 'first'),
  ).rejects.toThrow('account/provider must be unique')
  for (const transactionID of [undefined, 'missing']) {
    await expect(
      insertIdentityAssociation(
        { ...f.req, transactionID } as PayloadRequest,
        'customers',
        'google',
        'fresh',
        'new',
      ),
    ).rejects.toThrow('AUTH_STORAGE_UNAVAILABLE')
  }
  expect(f.create).toHaveBeenCalledTimes(3)
  expect(await findIdentityAccount(f.req, 'customers', 'google', 'subject')).toBe('first')
})
