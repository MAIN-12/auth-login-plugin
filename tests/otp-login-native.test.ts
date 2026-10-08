import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createOtpSession, isProvenSessionRequest } from '../src/auth/server/otpSession'
import { credentialVersion } from '../src/auth/server/credentialRequest'
import { selectOtpEvidence } from '../src/auth/infrastructure/payload/otpLogin'
vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  jwtSign: async () => ({ token: 'private-native-token', exp: 9_999_999_999 }),
}))
vi.mock('payload/internal', () => ({
  applyUserReadAccess: async ({ user }: { user: unknown }) => user,
}))
function fixture() {
  const record = {
    id: 'account-A',
    email: 'user@example.com',
    _verified: true,
    hash: 'unchanged-hash',
    salt: 'unchanged-salt',
    sessions: [],
  }
  const beforeLogin: Array<(args: { req: PayloadRequest }) => Promise<void>> = []
  const afterLogin: Array<() => Promise<void>> = []
  const tx = {}
  const execute = vi.fn(async () => undefined)
  const write = vi.fn(async () => undefined)
  const db = {
    name: 'postgres',
    tableNameMap: new Map([['customers', 'customers']]),
    sessions: {},
    drizzle: { transaction: async (work: (tx: unknown) => Promise<unknown>) => work(tx) },
    execute,
    findOne: vi.fn(async () => ({ ...record })),
    updateOne: write,
  }
  const originalUser = { id: 'original' }
  const req = {
    headers: new Headers(),
    user: originalUser,
    context: {},
    payload: {
      secret: 's'.repeat(32),
      db,
      collections: {
        customers: {
          config: {
            slug: 'customers',
            fields: [],
            auth: { cookies: {}, useSessions: true, tokenExpiration: 3600, maxLoginAttempts: 0 },
            hooks: { beforeLogin, afterLogin },
            access: { admin: async () => false },
          },
        },
      },
    },
  } as unknown as PayloadRequest
  const open = (assertCurrent?: () => Promise<void>) =>
    createOtpSession(
      req,
      record.id,
      'customers',
      record.email,
      credentialVersion(req.payload.secret, record),
      { method: 'otp' },
      undefined,
      assertCurrent,
    )
  return { record, req, originalUser, db, tx, execute, write, beforeLogin, afterLogin, open }
}
it('native commit denies credential evidence changed by an asynchronous login hook', async () => {
  const f = fixture()
  f.afterLogin.push(async () => {
    await Promise.resolve()
    f.record._verified = false
  })
  await expect(f.open()).rejects.toThrow('AUTH_FAILED')
  expect(f.req.user).toBe(f.originalUser)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
  expect(isProvenSessionRequest(f.req)).toBe(false)
})
it.each([
  null,
  {},
  { id: 'A', email: 'user@example.com' },
  { id: 'A', email: 'user@example.com', _verified: 'true' },
  { id: 'A', email: 'user@example.com', _verified: true, deletedAt: '2026-01-01' },
])('selected malformed/unknown/unverified/deleted evidence remains unavailable: %j', (record) => {
  expect(selectOtpEvidence(record).state).not.toBe('verified')
})
it('rechecks generation under the real native transaction and cleans up on async rejection', async () => {
  const f = fixture()
  let calls = 0
  await expect(
    f.open(async () => {
      expect(f.req.transactionID).toBeDefined()
      expect(Object.values(f.db.sessions)).toHaveLength(1)
      calls++
      if (calls === 2) throw new Error('AUTH_FAILED')
    }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(calls).toBe(2)
  expect(f.req.user).toBe(f.originalUser)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
  expect(isProvenSessionRequest(f.req)).toBe(false)
})
it('session writes never contain password/hash/salt and hooks see the exact request', async () => {
  const f = fixture()
  f.beforeLogin.push(async ({ req }) => {
    expect(req).toBe(f.req)
    expect(isProvenSessionRequest(req)).toBe(true)
  })
  const receipt = await f.open()
  expect(receipt.token).toBe('private-native-token')
  expect(f.write).toHaveBeenCalledTimes(1)
  const args = (
    f.write.mock.calls as unknown as [{ data: Record<string, unknown>; req: PayloadRequest }][]
  )[0][0]
  expect(args.req).toBe(f.req)
  expect(args.data).not.toHaveProperty('password')
  expect(args.data).not.toHaveProperty('hash')
  expect(args.data).not.toHaveProperty('salt')
  expect(args.data.sessions).toHaveLength(1)
  expect(f.req.transactionID).toBeUndefined()
  expect(f.db.sessions).toEqual({})
  expect(isProvenSessionRequest(f.req)).toBe(false)
})
it('an incompatible existing transaction never runs native auth/hooks or commits implicitly', async () => {
  const f = fixture()
  f.req.transactionID = 'foreign'
  await expect(f.open()).rejects.toThrow('AUTH_FAILED')
  expect(f.execute).not.toHaveBeenCalled()
  expect(f.write).not.toHaveBeenCalled()
  expect(f.req.transactionID).toBe('foreign')
  expect(f.req.user).toBe(f.originalUser)
})

import { PgDialect } from 'drizzle-orm/pg-core'
it('native account locks bind the proven account value and quote trusted adapter identifiers', async () => {
  const f = fixture()
  f.record.id = "o'hara"
  f.db.tableNameMap.set('customers', 'custom"accounts')
  await f.open()
  const args = (
    f.execute.mock.calls as unknown as [
      { raw?: string; sql?: import('drizzle-orm').SQL; db: unknown },
    ][]
  )[0][0]
  expect(args.db).toBe(f.tx)
  expect(args.raw).toBeUndefined()
  const query = new PgDialect().sqlToQuery(args.sql!)
  expect(query.params).toEqual(["o'hara"])
  expect(query.sql).toContain('"custom""accounts"')
  expect(query.sql).not.toContain("o'hara")
})

import { createNativeOtpLogin } from '../src/auth/infrastructure/payload/otpLogin'
it('request-bound OTP receipts stay isolated and restore temporary native authority', async () => {
  const first = fixture()
  const second = fixture()
  second.record.id = 'account-B'
  first.execute.mockImplementation(async () => ({ rows: [] }) as never)
  second.execute.mockImplementation(async () => ({ rows: [] }) as never)
  const a = createNativeOtpLogin(first.req, 'customers', '')
  const b = createNativeOtpLogin(second.req, 'customers', '')
  const referenceA = await a.findAccount(first.record.email)
  const referenceB = await b.findAccount(second.record.email)
  expect(referenceA).not.toBeNull()
  expect(referenceB).not.toBeNull()
  const principals = await Promise.all([
    a.session(referenceA!, first.record.email),
    b.session(referenceB!, second.record.email),
  ])
  expect(principals.map((principal) => principal.accountID)).toEqual(['account-A', 'account-B'])
  expect(principals).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ token: expect.any(String) })]),
  )
  expect(first.req.user).toBe(first.originalUser)
  expect(second.req.user).toBe(second.originalUser)
  expect(a.takeReceipt().user.id).toBe('account-A')
  expect(() => a.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  expect(b.takeReceipt().user.id).toBe('account-B')
  a.dispose()
  b.dispose()
  expect(first.db.sessions).toEqual({})
  expect(second.db.sessions).toEqual({})
})
it.each([
  { id: '', email: 'user@example.com', _verified: true },
  { id: Infinity, email: 'user@example.com', _verified: true },
  { id: NaN, email: 'user@example.com', _verified: true },
  { id: 'A', email: '', _verified: true },
  { id: 'A', email: 'USER@example.com', _verified: true },
])('malformed selected identity never becomes verified: %j', (record) => {
  expect(selectOtpEvidence(record).state).toBe('unknown')
})

import { createOtpEndpoints } from '../src/auth/composition/otpLogin'
import type { OtpOptions } from '../src/config'
import { publicConfig } from './auth-test-config'
it('two real OTP endpoint factories capture independent settings/secrets and interleave isolated request scopes', async () => {
  const rows = new Map<string, string>()
  const pool = {
    query: async () => undefined,
    connect: async () => ({
      release: () => {},
      query: async (sql: string, args: string[] = []) => {
        if (sql.startsWith('UPDATE auth_login_otp_security')) rows.set(args[1], args[0])
        return {
          rows:
            sql.startsWith('SELECT value') && rows.has(args[0])
              ? [{ value: rows.get(args[0]) }]
              : [],
        }
      },
    }),
  }
  const a = fixture()
  const b = fixture()
  b.record.id = 'account-B'
  const build = (
    f: ReturnType<typeof fixture>,
    collection: string,
    secret: string,
    locale: 'es' | 'en',
  ) => {
    const collections = f.req.payload.collections as unknown as Record<string, unknown>
    collections[collection] = collections.customers
    f.db.tableNameMap.set(collection, collection)
    Object.assign(f.db, { pool })
    f.execute.mockImplementation(async () => ({ rows: [] }) as never)
    const mail: string[] = []
    Object.assign(f.req.payload, {
      sendEmail: async (message: { html: string }) => {
        mail.push(message.html)
      },
      config: { csrf: [], cors: [], cookiePrefix: collection },
      logger: { info: () => {} },
    })
    const options: OtpOptions = {
      secret,
      origin: () => 'trusted-peer',
      ttlSeconds: 300,
      email: { from: 'test@example.com', locale },
    }
    const settings = { ...publicConfig, collection, otpLogin: true }
    const endpoints = createOtpEndpoints(settings, options)
    // Both factories must retain the configuration that built them.
    options.secret = 'mutated-invalid-key'
    options.ttlSeconds = 1
    options.email!.locale = locale === 'es' ? 'en' : 'es'
    settings.collection = 'wrong'
    settings.otpLogin = false
    const call = async (action: number, body: unknown) => {
      const r = new Request('https://host.test/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      Object.assign(f.req, { headers: r.headers, body: r.body })
      return (await endpoints[action].handler(f.req)) as Response
    }
    return { call, mail }
  }
  const first = build(a, 'customers', 'a'.repeat(32), 'es')
  const second = build(b, 'members', 'b'.repeat(32), 'en')
  const sent = await Promise.all([
    first.call(0, { email: a.record.email, purpose: 'login' }),
    second.call(0, { email: b.record.email, purpose: 'login' }),
  ])
  const contexts = await Promise.all(
    sent.map(async (response) => (await response.json()).context as string),
  )
  const codeA = first.mail[0].match(/>\s*(\d{6})\s*</)![1]
  const codeB = second.mail[0].match(/>\s*(\d{6})\s*</)![1]
  expect(first.mail[0]).toContain('lang="es"')
  expect(second.mail[0]).toContain('lang="en"')
  const crossed = await second.call(1, {
    email: b.record.email,
    purpose: 'login',
    context: contexts[0],
    otp: codeA,
  })
  expect(crossed.status).toBe(401)
  expect(b.write).not.toHaveBeenCalled()
  const verified = await Promise.all([
    first.call(1, { email: a.record.email, purpose: 'login', context: contexts[0], otp: codeA }),
    second.call(1, { email: b.record.email, purpose: 'login', context: contexts[1], otp: codeB }),
  ])
  const receipts = await Promise.all(verified.map((response) => response.json()))
  expect(receipts).toEqual([
    expect.objectContaining({ success: true }),
    expect.objectContaining({ success: true }),
  ])
  expect(receipts.map((receipt) => receipt.user.id)).toEqual(['account-A', 'account-B'])
  expect(verified[0].headers.get('Set-Cookie')).toContain('customers-token=')
  expect(verified[1].headers.get('Set-Cookie')).toContain('members-token=')
  expect(a.req.user).toBe(a.originalUser)
  expect(b.req.user).toBe(b.originalUser)
  expect(a.req.transactionID).toBeUndefined()
  expect(b.req.transactionID).toBeUndefined()
  expect(a.db.sessions).toEqual({})
  expect(b.db.sessions).toEqual({})
})
