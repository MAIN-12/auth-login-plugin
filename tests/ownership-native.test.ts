import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import {
  passwordReauthentication,
  commitPassword,
  commitEmailVerification,
} from '../src/auth/server/passwordAdapter'
import {
  credentialVersion,
  isCredentialRequest,
  isReauthenticationRequest,
} from '../src/auth/server/credentialRequest'
import {
  installNativeSessionCoordination,
  type DrizzleDatabase,
} from '../src/auth/server/otpSession'
const { login } = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  loginOperation: login,
}))
vi.mock('../src/auth/server/otpSession', async (original) => ({
  ...(await original<typeof import('../src/auth/server/otpSession')>()),
  nativeTransaction: (db: DrizzleDatabase, work: (tx: unknown) => Promise<unknown>) =>
    db.drizzle.transaction(work),
}))
function fixture() {
  const record = {
    id: 1,
    email: 'owner@example.com',
    hash: 'native-hash',
    salt: 'native-salt',
    _verified: true,
    sessions: [{ id: 'sid', createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
  }
  const db = {
    name: 'postgres',
    sessions: {},
    tableNameMap: new Map([['customers', 'customers']]),
    drizzle: { transaction: async (work: (tx: unknown) => Promise<unknown>) => work({}) },
    execute: vi.fn(async () => ({ rows: [] })),
    findOne: vi.fn(async () => ({ ...record })),
    updateOne: vi.fn(async (args: { data: Record<string, unknown> }) => {
      Object.assign(record, args.data)
      return { ...record }
    }),
    create: vi.fn(),
  }
  const update = vi.fn()
  const req = {
    user: { ...record, collection: 'customers', _sid: 'sid' },
    payload: {
      db,
      secret: 'secret',
      update,
      collections: {
        customers: {
          config: {
            slug: 'customers',
            hooks: {},
            auth: { tokenExpiration: 60, useSessions: true, maxLoginAttempts: 0 },
          },
        },
      },
    },
  } as unknown as PayloadRequest
  return { req, db, record, update }
}
it('native reauth rejects credential replacement by an asynchronous login hook and cleans request markers', async () => {
  const { req, db, record } = fixture()
  const original = req.user
  installNativeSessionCoordination(req.payload, 'customers')
  login.mockImplementationOnce(async (args) => {
    expect(req.transactionID).toBeUndefined()
    await simulateNativeLogin(args, record, async () => {
      await Promise.resolve()
      record.hash = 'replaced-by-hook'
    })
  })
  await expect(passwordReauthentication(req, 'customers', 'legacy')).rejects.toThrow('AUTH_FAILED')
  expect(req.user).toBe(original)
  expect(req.transactionID).toBeUndefined()
  expect(db.sessions).toEqual({})
  expect(isReauthenticationRequest(req)).toBe(false)
  expect(isCredentialRequest(req)).toBe(false)
})

it.each(['id', '_sid'] as const)(
  'credential commit rejects changed principal %s under its native boundary without a write',
  async (field) => {
    const { req, db, record, update } = fixture()
    const permit = {
      purpose: 'reauth' as const,
      email: record.email,
      account: record.id,
      sid: 'sid',
      version: credentialVersion(req.payload.secret, record),
      nonce: 'a'.repeat(64),
      expiresAt: Date.now() + 60_000,
    }
    req.user![field] = field === 'id' ? 2 : 'changed-sid'
    await expect(
      commitPassword(req, 'customers', permit, 'a long owner chosen phrase'),
    ).rejects.toThrow('AUTH_FAILED')
    expect(update).not.toHaveBeenCalled()
    expect(db.updateOne).not.toHaveBeenCalled()
    expect(req.transactionID).toBeUndefined()
    expect(db.sessions).toEqual({})
  },
)
it('email verification denies asynchronous credential substitution and restores request state', async () => {
  const { req, db, record, update } = fixture()
  record._verified = false
  const original = req.user
  const version = credentialVersion(req.payload.secret, record)
  update.mockImplementationOnce(async () => {
    await Promise.resolve()
    record._verified = true
    record.hash = 'substituted'
  })
  await expect(
    commitEmailVerification(
      req,
      'customers',
      { purpose: 'verify-email', email: record.email, account: record.id, version },
      async () => {},
    ),
  ).rejects.toThrow('AUTH_FAILED')
  expect(req.user).toBe(original)
  expect(req.transactionID).toBeUndefined()
  expect(db.sessions).toEqual({})
  expect(db.updateOne).not.toHaveBeenCalled()
})
it('credential completion rejects generation invalidated after permit decoding before writes', async () => {
  const { req, db, record, update } = fixture()
  const permit = {
    purpose: 'recovery' as const,
    email: record.email,
    account: record.id,
    version: credentialVersion(req.payload.secret, record),
    nonce: 'a'.repeat(64),
    expiresAt: Date.now() + 60_000,
  }
  await expect(
    commitPassword(
      req,
      'customers',
      permit,
      'a long owner chosen phrase',
      Date.now,
      undefined,
      async () => {
        throw new Error('AUTH_FAILED')
      },
    ),
  ).rejects.toThrow('AUTH_FAILED')
  expect(update).not.toHaveBeenCalled()
  expect(db.sessions).toEqual({})
})
it('a parsed recovery proof cannot issue a permit after the native credential version changes', async () => {
  const { grantOwnershipPermit } = await import('../src/auth/server/passwordAdapter')
  const { req, record } = fixture()
  const proof = {
    purpose: 'recovery' as const,
    email: record.email,
    account: record.id,
    version: credentialVersion(req.payload.secret, record),
  }
  record.hash = 'replaced-after-read'
  const issue = vi.fn()
  await expect(grantOwnershipPermit(req, 'customers', proof, issue)).rejects.toThrow('AUTH_FAILED')
  expect(issue).not.toHaveBeenCalled()
})
it('completion rolls back authority when an asynchronous hook substitutes the password after its native write', async () => {
  const { observeCredentialWrite } = await import('../src/auth/server/credentialIntent')
  const { req, record, update, db } = fixture()
  const permit = {
    purpose: 'recovery' as const,
    email: record.email,
    account: record.id,
    version: credentialVersion(req.payload.secret, record),
    nonce: 'a'.repeat(64),
    expiresAt: Date.now() + 60_000,
  }
  update.mockImplementationOnce(async () => {
    observeCredentialWrite(req, { hash: 'owner-native-hash', salt: 'owner-native-salt' })
    await Promise.resolve()
    record.hash = 'hook-native-hash'
    record.salt = 'hook-native-salt'
  })
  await expect(
    commitPassword(req, 'customers', permit, 'a long owner chosen phrase'),
  ).rejects.toThrow('AUTH_FAILED')
  expect(db.updateOne).not.toHaveBeenCalled()
  expect(req.transactionID).toBeUndefined()
  expect(isCredentialRequest(req)).toBe(false)
})

it('two real ownership endpoint factories capture secrets/settings and cannot complete a cross-collection permit', async () => {
  const { createOwnershipOtpEndpoint, createOwnershipScope } =
    await import('../src/auth/composition/ownership')
  const { publicConfig } = await import('./auth-test-config')
  const rows = new Map<string, string>()
  const pool = {
    query: async () => undefined,
    connect: async () => ({
      release: () => {},
      query: async (query: string, args: string[] = []) => {
        if (query.startsWith('UPDATE auth_login_otp_security')) rows.set(args[1], args[0])
        return {
          rows:
            query.startsWith('SELECT value') && rows.has(args[0])
              ? [{ value: rows.get(args[0]) }]
              : [],
        }
      },
    }),
  }
  const make = (collection: string, secret: string) => {
    const config = { ...publicConfig, collection, passwordLogin: true, allowSignup: true }
    const options = {
      secret,
      origin: () => 'trusted-peer',
      email: { from: 'auth@example.com' },
      random: () => '123456',
    }
    const create = vi.fn()
    const payload = {
      secret,
      db: {
        name: 'postgres',
        pool,
        sessions: {},
        drizzle: { transaction: async (work: (tx: unknown) => Promise<unknown>) => work({}) },
        execute: async () => ({ rows: [] }),
        findOne: async () => null,
      },
      create,
      sendEmail: vi.fn(async () => {}),
      config: { cors: [], csrf: [] },
      logger: { info: () => {} },
    }
    const req = (input: unknown) =>
      Object.assign(
        new Request('https://host.test/api/otp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        }),
        { payload },
      ) as unknown as PayloadRequest
    const send = createOwnershipOtpEndpoint(config, options, 'send')
    const verify = createOwnershipOtpEndpoint(config, options, 'verify')
    config.allowSignup = false
    options.secret = 'changed-after-factory'.repeat(3)
    return { config, req, create, send, verify }
  }
  const a = make('customers', 'secret-A'.repeat(5))
  const b = make('members', 'secret-B'.repeat(5))
  const input = { purpose: 'signup', email: 'owner@example.com' }
  const sent = (await Promise.all([
    a.send.handler(a.req(input)),
    b.send.handler(b.req(input)),
  ])) as Response[]
  const [first, second] = await Promise.all(sent.map((response) => response.json()))
  for (const body of [first, second])
    expect(Object.keys(body).sort()).toEqual(['code', 'context', 'retryAfter', 'success'])
  const response = (await a.verify.handler(
    a.req({ ...input, context: first.context, otp: '123456' }),
  )) as Response
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  const grant = await response.json()
  expect(Object.keys(grant).sort()).toEqual(['expiresAt', 'permit', 'success'])
  expect(JSON.stringify(grant)).not.toMatch(/owner@example|hash|salt|secret-A/)
  const scope = createOwnershipScope({ ...b.config, allowSignup: true }, b.req({}))
  await expect(
    scope.complete('signup', { permit: grant.permit, password: 'a long owner chosen phrase' }),
  ).rejects.toThrow('AUTH_FAILED')
  scope.dispose()
  expect(b.create).not.toHaveBeenCalled()
  const cross = (await b.verify.handler(
    b.req({ ...input, context: first.context, otp: '123456' }),
  )) as Response
  expect(cross.status).toBe(401)
  const own = (await b.verify.handler(
    b.req({ ...input, context: second.context, otp: '123456' }),
  )) as Response
  expect(own.status).toBe(200)
  expect(a.create).not.toHaveBeenCalled()
  expect(b.create).not.toHaveBeenCalled()
})
it.each([
  { id: '', email: 'owner@example.com' },
  { id: Infinity, email: 'owner@example.com' },
  { id: 1, email: 'OWNER@example.com' },
])(
  'malformed native ownership identity remains unknown and never exposes hash/salt: %j',
  async (identity) => {
    const { mapOwnershipAccount } = await import('../src/auth/server/ownershipAccount')
    const selected = mapOwnershipAccount(
      { ...identity, hash: 'private-native-hash', salt: 'private-native-salt', verified: true },
      'opaque-version',
    )
    expect(selected.state).toBe('unknown')
    expect(selected).not.toHaveProperty('hash')
    expect(selected).not.toHaveProperty('salt')
  },
)

async function simulateNativeLogin(
  args: Parameters<typeof import('payload').loginOperation>[0],
  record: {
    id: number
    email: string
    hash: string
    salt: string
    _verified: boolean
    sessions: { id: string; createdAt: Date; expiresAt: Date }[]
  },
  hook: () => Promise<void> = async () => {},
) {
  const { req } = args
  await req.payload.db.updateOne({
    collection: 'customers',
    id: record.id,
    req,
    returning: false,
    data: {
      ...record,
      updatedAt: null,
      sessions: [
        ...record.sessions,
        {
          id: 'forbidden-new-session',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    },
  })
  await hook()
  for (const guard of args.collection.config.hooks.beforeLogin ?? [])
    await guard({
      req,
      user: { ...record },
      collection: args.collection.config,
      context: req.context,
    })
  let result = { user: { ...record }, token: 'inert-native-token', exp: 9999999999 }
  for (const guard of args.collection.config.hooks.afterOperation ?? []) {
    result = (await guard({
      req,
      operation: 'login',
      result,
      args,
      collection: args.collection.config,
      overrideAccess: false,
    })) as typeof result
  }
  return result
}
it('incorrect native reauth reaches the lockout write before any credential/native transaction starts', async () => {
  const { req, db } = fixture()
  login.mockImplementationOnce(async () => {
    expect(req.transactionID).toBeUndefined()
    expect(db.execute).not.toHaveBeenCalled()
    await req.payload.db.updateOne({ collection: 'customers', id: 1, data: { loginAttempts: 1 } })
    throw new Error('AUTH_FAILED')
  })
  await expect(passwordReauthentication(req, 'customers', 'incorrect')).rejects.toThrow(
    'AUTH_FAILED',
  )
  expect(db.updateOne).toHaveBeenCalledWith(expect.objectContaining({ data: { loginAttempts: 1 } }))
  expect(isReauthenticationRequest(req)).toBe(false)
  expect(req.transactionID).toBeUndefined()
})
it('native conditional legacy rehash remains valid while hooks cannot substitute the upgraded credential', async () => {
  const { req, db, record } = fixture()
  const original = req.user
  installNativeSessionCoordination(req.payload, 'customers')
  login.mockImplementationOnce(async (args) =>
    simulateNativeLogin(args, record, async () => {
      const where = {
        id: { equals: record.id },
        hash: { equals: record.hash },
        salt: { equals: record.salt },
      }
      await req.payload.db.updateOne({
        collection: 'customers',
        req,
        where,
        select: { id: true },
        data: { hash: 'pbkdf2-sha256-v1:native-upgrade', salt: 'native-upgrade-salt' },
      })
    }),
  )
  const proof = await passwordReauthentication(req, 'customers', 'legacy')
  expect(proof).toEqual({
    purpose: 'reauth',
    email: record.email,
    account: record.id,
    sid: 'sid',
    version: credentialVersion(req.payload.secret, record),
  })
  expect(record.sessions.map((session) => session.id)).toEqual(['sid'])
  expect(req.user).toBe(original)
  expect(req.transactionID).toBeUndefined()
  expect(db.sessions).toEqual({})
  expect(isReauthenticationRequest(req)).toBe(false)
})
