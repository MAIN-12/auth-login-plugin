import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  resolveGoogleAccount,
  methodPermits,
} from '../src/auth/infrastructure/payload/googleAccountCommit'
import { credentialVersion, isCredentialRequest } from '../src/auth/server/credentialRequest'
import type { DrizzleDatabase } from '../src/auth/server/otpSession'
import { publicConfig } from './auth-test-config'
vi.mock('../src/auth/server/otpSession', async (original) => ({
  ...(await original<typeof import('../src/auth/server/otpSession')>()),
  nativeTransaction: (db: DrizzleDatabase, work: (tx: unknown) => Promise<unknown>) =>
    db.drizzle.transaction(work),
}))
function fixture() {
  const tx = {}
  const record = {
    id: 1,
    email: 'owner@example.com',
    _verified: true,
    hash: 'hash',
    salt: 'salt',
    sessions: [{ id: 'sid', expiresAt: new Date(100000).toISOString() }],
  }
  let associated: string | undefined
  const inserts: unknown[][] = []
  const dialect = new PgDialect()
  const db = {
    name: 'postgres',
    tableNameMap: new Map([['customers', 'customers']]),
    sessions: {},
    drizzle: { transaction: async (work: (tx: unknown) => Promise<unknown>) => work(tx) },
    execute: vi.fn(async (args: Parameters<DrizzleDatabase['execute']>[0]) => {
      if (args.sql) {
        const query = dialect.sqlToQuery(args.sql)
        if (query.sql.includes('auth_login_google_identities')) {
          expect(query.sql).not.toContain("sub'quoted")
          if (query.sql.startsWith('SELECT'))
            return { rows: associated ? [{ account: associated }] : [] }
          expect(args.db).toBe(tx)
          inserts.push(query.params)
          associated = String(query.params[2])
        }
      }
      return { rows: [] }
    }),
    findOne: vi.fn(async () => ({ ...record })),
    updateOne: vi.fn(),
  }
  const create = vi.fn()
  const req = {
    user: { ...record, collection: 'customers', _sid: 'sid' },
    payload: {
      db,
      create,
      secret: 'test-secret',
      collections: { customers: { config: { auth: { maxLoginAttempts: 0 } } } },
    },
  } as unknown as PayloadRequest
  const settings = { ...publicConfig, collection: 'customers', googleOAuthEnabled: true }
  const principal = {
    id: 1,
    email: record.email,
    sid: 'sid',
    version: credentialVersion(req.payload.secret, record),
  }
  const correlation = {
    state: 'a'.repeat(43),
    nonce: 'nonce',
    verifier: 'verifier',
    browser: 'browser',
    returnTo: '/',
    expiresAt: 601000,
    purpose: 'link' as const,
    principal,
  }
  const identity = { sub: "sub'quoted", email: record.email, emailVerified: true }
  return {
    req,
    db,
    record,
    settings,
    principal,
    correlation,
    identity,
    inserts,
    create,
    associate: (id: string) => {
      associated = id
    },
  }
}
it('link rechecks principal after awaited generation/permit work under its native commit and cleans on rejection', async () => {
  const f = fixture()
  const original = f.req.user
  const grant = (await methodPermits(f.req, f.settings, () => 1000)).grant({
    purpose: 'reauth',
    account: 1,
    sid: 'sid',
    email: f.record.email,
    version: f.principal.version,
  })
  let checks = 0
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      f.identity,
      { ...f.correlation, permit: grant.permit },
      () => 1000,
      undefined,
      async () => {
        if (++checks === 2) f.req.user = { ...original!, _sid: 'changed' }
      },
    ),
  ).rejects.toThrow('AUTH_FAILED')
  expect(f.req.user).toBe(original)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
  expect(isCredentialRequest(f.req)).toBe(false)
})
it('explicit link uses bound collection/sub/account values and real req, then cleans native request state', async () => {
  const f = fixture()
  const grant = (await methodPermits(f.req, f.settings, () => 1000)).grant({
    purpose: 'reauth',
    account: 1,
    sid: 'sid',
    email: f.record.email,
    version: f.principal.version,
  })
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      f.identity,
      { ...f.correlation, permit: grant.permit },
      () => 1000,
    ),
  ).resolves.toMatchObject({ account: { id: 1 } })
  expect(f.inserts).toEqual([['customers', "sub'quoted", '1']])
  for (const [args] of f.db.findOne.mock.calls as unknown as [{ req: PayloadRequest }][])
    expect(args.req).toBe(f.req)
  expect(f.db.sessions).toEqual({})
  expect(f.req.transactionID).toBeUndefined()
  expect(isCredentialRequest(f.req)).toBe(false)
})
it('matching email cannot auto-link or provision an existing local account', async () => {
  const f = fixture()
  await expect(
    resolveGoogleAccount(
      f.req,
      { ...f.settings, allowSignup: true },
      f.identity,
      { ...f.correlation, purpose: 'login', principal: undefined },
      () => 1000,
    ),
  ).rejects.toThrow('AUTH_FAILED')
  expect(f.create).not.toHaveBeenCalled()
  expect(f.inserts).toEqual([])
  expect(f.db.sessions).toEqual({})
})
it('native uniqueness rejection throws once without retrying permit or identity effects and cleans state', async () => {
  const f = fixture()
  const originalUser = f.req.user
  const grant = (await methodPermits(f.req, f.settings, () => 1000)).grant({
    purpose: 'reauth',
    account: 1,
    sid: 'sid',
    email: f.record.email,
    version: f.principal.version,
  })
  const originalExecute = f.db.execute.getMockImplementation()!
  let attempts = 0
  f.db.execute.mockImplementation(async (args) => {
    if (
      args.sql &&
      new PgDialect()
        .sqlToQuery(args.sql)
        .sql.startsWith('INSERT INTO auth_login_google_identities')
    ) {
      attempts++
      await Promise.resolve()
      throw new Error('native unique account constraint')
    }
    return originalExecute(args)
  })
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      f.identity,
      { ...f.correlation, permit: grant.permit },
      () => 1000,
    ),
  ).rejects.toThrow('native unique account constraint')
  expect(attempts).toBe(1)
  expect(f.create).not.toHaveBeenCalled()
  expect(f.req.user).toBe(originalUser)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
  expect(isCredentialRequest(f.req)).toBe(false)
})
it('a rival subject association observed after insert denies the native commit and cleans all request state', async () => {
  const f = fixture()
  const originalUser = f.req.user
  const grant = (await methodPermits(f.req, f.settings, () => 1000)).grant({
    purpose: 'reauth',
    account: 1,
    sid: 'sid',
    email: f.record.email,
    version: f.principal.version,
  })
  const originalExecute = f.db.execute.getMockImplementation()!
  f.db.execute.mockImplementation(async (args) => {
    const result = await originalExecute(args)
    if (
      args.sql &&
      new PgDialect()
        .sqlToQuery(args.sql)
        .sql.startsWith('INSERT INTO auth_login_google_identities')
    )
      f.associate('rival-account')
    return result
  })
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      f.identity,
      { ...f.correlation, permit: grant.permit },
      () => 1000,
    ),
  ).rejects.toThrow('AUTH_FAILED')
  expect(f.req.user).toBe(originalUser)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
  expect(isCredentialRequest(f.req)).toBe(false)
})
