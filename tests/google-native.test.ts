import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  resolveGoogleAccount,
  methodPermits,
} from '../src/authentication/infrastructure/payload/googleAccountCommit'
import {
  credentialVersion,
  isCredentialRequest,
} from '../src/collections/ConfiguredAuthCollection/infrastructure/payload/credentialRequest'
import type { DrizzleDatabase } from '../src/shared/infrastructure/payload/nativeTransaction'
import { publicConfig } from './auth-test-config'
vi.mock(
  '../src/collections/ConfiguredAuthCollection/infrastructure/payload/otpSession',
  async (original) => ({
    ...(await original<
      typeof import('../src/collections/ConfiguredAuthCollection/infrastructure/payload/otpSession')
    >()),
    nativeTransaction: (db: DrizzleDatabase, work: (tx: unknown) => Promise<unknown>) =>
      db.drizzle.transaction(work),
  }),
)
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
        if (query.sql.includes('auth_login_identities')) {
          expect(query.sql).not.toContain("sub'quoted")
          expect(query.params[1]).toBe('google')
          if (query.sql.startsWith('SELECT'))
            return { rows: associated ? [{ account: associated }] : [] }
          expect(args.db).toBe(tx)
          inserts.push(query.params)
          associated = String(query.params[3])
        }
      }
      return { rows: [] }
    }),
    findOne: vi.fn(async (args: { collection: string }) =>
      args.collection === 'auth-login-cutovers' ? null : { ...record },
    ),
    create: vi.fn(async (args: { collection: string; req: PayloadRequest }) => {
      expect(args.collection).toBe('auth-login-password-permits')
      expect(args.req).toBe(req)
      expect(args.req.transactionID).toBeDefined()
      return null
    }),
    updateOne: vi.fn(),
  }
  const create = vi.fn()
  const req = {
    user: { ...record, collection: 'customers', _sid: 'sid' },
    payload: {
      db,
      find: vi.fn(async (args: { collection: string; overrideAccess: boolean; req: unknown }) => {
        expect(args.collection).toBe('auth-login-identities')
        expect(args.overrideAccess).toBe(true)
        expect(args.req).toBe(req)
        return { docs: associated ? [{ account: associated }] : [] }
      }),
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
  expect(f.inserts).toEqual([['customers', 'google', "sub'quoted", '1']])
  for (const [args] of f.db.findOne.mock.calls as unknown as [{ req: PayloadRequest }][])
    expect(args.req).toBe(f.req)
  expect(f.db.sessions).toEqual({})
  expect(f.req.transactionID).toBeUndefined()
  expect(isCredentialRequest(f.req)).toBe(false)
})
it('external matching email without Workspace authority cannot auto-link or provision a local account', async () => {
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
      new PgDialect().sqlToQuery(args.sql).sql.startsWith('INSERT INTO auth_login_identities')
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
      new PgDialect().sqlToQuery(args.sql).sql.startsWith('INSERT INTO auth_login_identities')
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

it.each([
  { email: 'owner@gmail.com', hostedDomain: undefined },
  { email: 'owner@company.com', hostedDomain: 'company.com' },
])(
  'authoritative email associates verified local account with signup closed: $email',
  async ({ email, hostedDomain }) => {
    const f = fixture()
    f.record.email = email
    Object.assign(f.record, { roles: ['superadmin'] })
    const original = f.req.user
    const before = { ...f.record }
    await expect(
      resolveGoogleAccount(
        f.req,
        { ...f.settings, allowSignup: false },
        { ...f.identity, email, hostedDomain },
        { ...f.correlation, purpose: 'login', principal: undefined },
        () => 1000,
      ),
    ).resolves.toMatchObject({
      account: {
        id: 1,
        email,
        _verified: true,
        hash: 'hash',
        salt: 'salt',
        sessions: before.sessions,
        roles: ['superadmin'],
      },
    })
    expect(f.inserts).toEqual([['customers', 'google', "sub'quoted", '1']])
    expect(f.record).toEqual(before)
    expect(f.create).not.toHaveBeenCalled()
    expect(f.db.updateOne).not.toHaveBeenCalled()
    expect(f.req.user).toBe(original)
    expect(f.req.transactionID).toBeUndefined()
    expect(f.db.sessions).toEqual({})
  },
)

it.each([
  ['different-string', '2', 'string', '2', false],
  ['numeric', 1, 'number', 1, true],
  ['null', null, 'null', undefined, false],
  [
    'object',
    {
      id: 'private-object',
      toString: () => {
        throw new Error('must not convert')
      },
    },
    'object',
    undefined,
    false,
  ],
  ['unsafe-string', 'private@example.com', 'string', undefined, false],
  ['long-string', 'a'.repeat(129), 'string', undefined, false],
] as const)(
  'association conflict logs a safe tagged snapshot for %s',
  async (_kind, observed, type, safeID, convertedMatch) => {
    const f = fixture()
    const info = vi.fn()
    f.req.payload.logger = { info } as unknown as PayloadRequest['payload']['logger']
    const find = f.req.payload.find
    vi.mocked(find).mockImplementation(
      async () =>
        ({
          docs: f.inserts.length ? [{ account: observed }] : [],
        }) as Awaited<ReturnType<typeof find>>,
    )
    await expect(
      resolveGoogleAccount(
        f.req,
        f.settings,
        { ...f.identity, email: f.record.email, hostedDomain: 'example.com' },
        { ...f.correlation, purpose: 'login', principal: undefined },
        () => 1000,
      ),
    ).rejects.toMatchObject({ reason: 'GOOGLE_ASSOCIATION_CONFLICT' })
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith({
      event: '[DEBUG-google-association]',
      lookups: [
        {
          phase: 'initial',
          associationFound: false,
          associationAccountType: 'undefined',
          nativeAccountFound: false,
          nativeAccountIdType: 'undefined',
          matchesExpected: false,
          matchesAfterStringConversion: false,
        },
        {
          phase: 'locked',
          associationFound: false,
          associationAccountType: 'undefined',
          nativeAccountFound: false,
          nativeAccountIdType: 'undefined',
          matchesExpected: false,
          matchesAfterStringConversion: false,
        },
        {
          phase: 'post-association',
          associationFound: true,
          associationAccountType: type,
          nativeAccountFound: true,
          nativeAccountIdType: 'number',
          expectedAccountId: 1,
          ...(safeID === undefined ? {} : { observedAssociationAccount: safeID }),
          matchesExpected: false,
          matchesAfterStringConversion: convertedMatch,
        },
      ],
    })
    expect(JSON.stringify(info.mock.calls)).not.toMatch(
      /private|owner|sub|hash|salt|nonce|verifier/,
    )
    expect(f.req.transactionID).toBeUndefined()
    expect(f.db.sessions).toEqual({})
  },
)

it('a throwing diagnostic logger cannot change association-conflict rejection or cleanup', async () => {
  const f = fixture()
  const info = vi.fn(() => {
    throw new Error('private logger failure')
  })
  f.req.payload.logger = { info } as unknown as PayloadRequest['payload']['logger']
  const find = f.req.payload.find
  vi.mocked(find).mockImplementation(
    async () =>
      ({
        docs: f.inserts.length ? [{ account: '2' }] : [],
      }) as Awaited<ReturnType<typeof find>>,
  )
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      { ...f.identity, email: f.record.email, hostedDomain: 'example.com' },
      { ...f.correlation, purpose: 'login', principal: undefined },
      () => 1000,
    ),
  ).rejects.toMatchObject({ reason: 'GOOGLE_ASSOCIATION_CONFLICT' })
  expect(info).toHaveBeenCalledTimes(1)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
})

it('successful association stays quiet while the temporary conflict probe is installed', async () => {
  const f = fixture()
  const info = vi.fn()
  f.req.payload.logger = { info } as unknown as PayloadRequest['payload']['logger']
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      { ...f.identity, email: f.record.email, hostedDomain: 'example.com' },
      { ...f.correlation, purpose: 'login', principal: undefined },
      () => 1000,
    ),
  ).resolves.toMatchObject({ account: { id: 1 } })
  expect(info).not.toHaveBeenCalled()
})

it('the conflict snapshot treats undefined initial and locked native accounts as missing', async () => {
  const f = fixture()
  const info = vi.fn()
  f.req.payload.logger = { info } as unknown as PayloadRequest['payload']['logger']
  const findOne = f.db.findOne.getMockImplementation()!
  f.db.findOne.mockImplementation(async (args) => {
    const where = (args as { where?: { id?: unknown } }).where
    if (args.collection === 'customers' && where?.id && !f.inserts.length) return undefined as never
    return findOne(args)
  })
  const find = f.req.payload.find
  vi.mocked(find).mockImplementation(
    async () =>
      ({
        docs: [{ account: f.inserts.length ? '2' : '1' }],
      }) as Awaited<ReturnType<typeof find>>,
  )
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      { ...f.identity, email: f.record.email, hostedDomain: 'example.com' },
      { ...f.correlation, purpose: 'login', principal: undefined },
      () => 1000,
    ),
  ).rejects.toMatchObject({ reason: 'GOOGLE_ASSOCIATION_CONFLICT' })
  expect(info).toHaveBeenCalledWith({
    event: '[DEBUG-google-association]',
    lookups: [
      expect.objectContaining({
        phase: 'initial',
        nativeAccountFound: false,
        nativeAccountIdType: 'undefined',
      }),
      expect.objectContaining({
        phase: 'locked',
        nativeAccountFound: false,
        nativeAccountIdType: 'undefined',
      }),
      expect.objectContaining({
        phase: 'post-association',
        nativeAccountFound: true,
        nativeAccountIdType: 'number',
      }),
    ],
  })
})
it.each(['unverified', 'deleted', 'locked', 'unverified-google', 'external-email'])(
  'autolink refuses %s before identity writes',
  async (kind) => {
    const f = fixture()
    f.record.email = 'owner@gmail.com'
    if (kind === 'unverified') f.record._verified = false
    if (kind === 'deleted') Object.assign(f.record, { deletedAt: new Date().toISOString() })
    if (kind === 'locked') {
      Object.assign(f.record, {
        lockUntil: new Date(Date.now() + 60000).toISOString(),
        loginAttempts: 10,
      })
      f.req.payload.collections.customers.config.auth.maxLoginAttempts = 5
    }
    await expect(
      resolveGoogleAccount(
        f.req,
        f.settings,
        {
          ...f.identity,
          email: kind === 'external-email' ? 'owner@outlook.com' : f.record.email,
          emailVerified: kind !== 'unverified-google',
        },
        { ...f.correlation, purpose: 'login', principal: undefined },
        () => 1000,
      ),
    ).rejects.toThrow()
    expect(f.inserts).toEqual([])
    expect(f.db.updateOne).not.toHaveBeenCalled()
    expect(f.create).not.toHaveBeenCalled()
    expect(f.req.transactionID).toBeUndefined()
  },
)
it.each(['subject-owner', 'account-provider', 'credential-change'])(
  'autolink rejects %s conflict without provisioning or altering credentials',
  async (kind) => {
    const f = fixture()
    f.record.email = 'owner@gmail.com'
    const execute = f.db.execute.getMockImplementation()!
    f.db.execute.mockImplementation(async (args) => {
      if (
        args.sql &&
        new PgDialect().sqlToQuery(args.sql).sql.startsWith('INSERT INTO auth_login_identities')
      ) {
        if (kind === 'account-provider') throw new Error('account provider unique conflict')
        const result = await execute(args)
        if (kind === 'subject-owner') f.associate('rival-account')
        if (kind === 'credential-change') f.record.hash = 'changed'
        return result
      }
      return execute(args)
    })
    await expect(
      resolveGoogleAccount(
        f.req,
        f.settings,
        { ...f.identity, email: f.record.email },
        { ...f.correlation, purpose: 'login', principal: undefined },
        () => 1000,
      ),
    ).rejects.toThrow(
      kind === 'account-provider' ? 'account provider unique conflict' : 'AUTH_FAILED',
    )
    expect(f.create).not.toHaveBeenCalled()
    expect(f.db.updateOne).not.toHaveBeenCalled()
    expect(f.req.transactionID).toBeUndefined()
    expect(f.db.sessions).toEqual({})
  },
)
it('native lockout is reported as account login denial without changing permission checks', async () => {
  const f = fixture()
  f.record.email = 'owner@main12.com'
  Object.assign(f.record, {
    roles: ['superadmin'],
    lockUntil: new Date(Date.now() + 60000).toISOString(),
    loginAttempts: 10,
  })
  f.req.payload.collections.customers.config.auth.maxLoginAttempts = 5
  await expect(
    resolveGoogleAccount(
      f.req,
      f.settings,
      { ...f.identity, email: f.record.email, hostedDomain: 'main12.com' },
      { ...f.correlation, purpose: 'login', principal: undefined },
      () => 1000,
    ),
  ).rejects.toMatchObject({
    code: 'AUTH_FAILED',
    reason: 'ACCOUNT_LOGIN_DENIED',
    message: 'AUTH_FAILED',
  })
  expect(f.inserts).toEqual([])
})

it.each([
  ['missing', 'ACCOUNT_NOT_FOUND'],
  ['email', 'ACCOUNT_EMAIL_CHANGED'],
  ['deleted', 'ACCOUNT_UNAVAILABLE'],
  ['verification', 'ACCOUNT_NOT_VERIFIED'],
  ['credentials', 'ACCOUNT_CREDENTIALS_CHANGED'],
  ['association-missing', 'GOOGLE_ASSOCIATION_NOT_PERSISTED'],
  ['association-owner', 'GOOGLE_ASSOCIATION_CONFLICT'],
] as const)(
  'Workspace login identifies the exact post-association %s failure',
  async (kind, reason) => {
    const f = fixture()
    f.record.email = 'owner@main12.com'
    Object.assign(f.record, { roles: ['superadmin'] })
    const original = f.req.user
    const before = { ...f.record }
    const findOne = f.db.findOne.getMockImplementation()!
    f.db.findOne.mockImplementation(async (args) => {
      if (args.collection === 'customers' && f.inserts.length) {
        if (kind === 'missing') return null
        return {
          ...f.record,
          ...(kind === 'email' ? { email: 'changed@main12.com' } : {}),
          ...(kind === 'deleted' ? { deletedAt: new Date(1000).toISOString() } : {}),
          ...(kind === 'verification' ? { _verified: false } : {}),
          ...(kind === 'credentials' ? { hash: 'changed' } : {}),
        }
      }
      return findOne(args)
    })
    const find = f.req.payload.find
    vi.mocked(find).mockImplementation(
      async () =>
        ({
          docs:
            !f.inserts.length || kind === 'association-missing'
              ? []
              : [{ account: kind === 'association-owner' ? 'rival' : '1' }],
        }) as Awaited<ReturnType<typeof find>>,
    )
    await expect(
      resolveGoogleAccount(
        f.req,
        { ...f.settings, allowSignup: false },
        { ...f.identity, email: f.record.email, hostedDomain: 'main12.com' },
        { ...f.correlation, purpose: 'login', principal: undefined },
        () => 1000,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_FAILED', reason, status: 401 })
    expect(f.record).toEqual(before)
    expect(f.create).not.toHaveBeenCalled()
    expect(f.db.updateOne).not.toHaveBeenCalled()
    expect(f.req.user).toBe(original)
    expect(f.req.transactionID).toBeUndefined()
    expect(f.db.sessions).toEqual({})
  },
)
