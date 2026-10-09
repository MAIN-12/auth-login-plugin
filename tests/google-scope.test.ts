import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createGoogleScope } from '../src/auth/composition/google'
import { publicConfig } from './auth-test-config'
import type { OtpStore } from '../src/auth/infrastructure/payload/otpLedger'
const doubles = vi.hoisted(() => ({
  session: vi.fn(),
  commit: vi.fn(),
  stores: new WeakMap<object, OtpStore>(),
}))
vi.mock('../src/auth/server/otpSession', () => ({ createOtpSession: doubles.session }))
vi.mock('../src/auth/infrastructure/payload/googleAccountCommit', () => ({
  resolveGoogleAccount: doubles.commit,
  methodPermits: vi.fn(),
}))
vi.mock('../src/auth/server/otpStore', () => ({
  createPayloadOtpStore: (req: PayloadRequest) => doubles.stores.get(req.payload)!,
}))
function fixture() {
  const records = new Map<string, Record<string, unknown>>()
  const db = {
    name: 'postgres',
    drizzle: {},
    sessions: {},
    execute: vi.fn(async () => ({ rows: [] })),
  }
  const req = {
    headers: new Headers({ host: 'app.test' }),
    user: undefined,
    payload: { secret: 'test-secret', db },
  } as unknown as PayloadRequest
  doubles.stores.set(req.payload, {
    transaction: async (_keys, work) =>
      work({
        get: async (key) => records.get(key),
        put: async (key, value) => {
          records.set(key, value)
        },
      }),
  })
  const provider = {
    authorize: vi.fn(async () => 'https://accounts.google.com/authorize'),
    exchange: vi.fn(async () => ({ sub: 'stable', emailVerified: true })),
  }
  const scope = (enabled = true) =>
    createGoogleScope(
      req,
      { ...publicConfig, googleOAuthEnabled: enabled },
      provider,
      'https://app.test/api/auth/oauth/google/callback',
      () => 1000,
    )
  return { req, provider, scope, db }
}
it('disabled native scope performs zero storage/provider effects and exposes no receipt', async () => {
  const f = fixture()
  const scope = f.scope(false)
  await expect(scope.start({ browser: 'one' })).rejects.toThrow('METHOD_DISABLED')
  expect(f.db.execute).not.toHaveBeenCalled()
  expect(f.provider.authorize).not.toHaveBeenCalled()
  expect(() => scope.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
})
it('native login uses the real req and keeps its receipt consumable once outside the application result', async () => {
  const f = fixture()
  const originalHeaders = f.req.headers
  doubles.commit.mockResolvedValueOnce({
    account: { id: 1, email: 'owner@example.com', hash: 'private-hash', salt: 'private-salt' },
  })
  doubles.session.mockResolvedValueOnce({ token: 'private-token', user: { id: 1 }, exp: 2000 })
  const start = await f.scope().start({ browser: 'one' })
  const callback = f.scope()
  const result = await callback.callback(start.state, 'one', 'https://app.test/callback')
  expect(result).toEqual({ result: { success: true }, purpose: 'login', returnTo: '/' })
  expect(JSON.stringify(result)).not.toMatch(/private-/)
  expect(doubles.commit.mock.calls.at(-1)![0]).toBe(f.req)
  expect(doubles.session.mock.calls.at(-1)![0]).toBe(f.req)
  expect(callback.takeReceipt()).toMatchObject({ token: 'private-token' })
  expect(() => callback.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  expect(f.req.headers).toBe(originalHeaders)
  expect(f.req.user).toBeUndefined()
  callback.dispose()
  await expect(callback.callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'AUTH_UNAVAILABLE',
  )
})
it('asynchronous native session failure cannot leak a receipt or revive callback, and scopes isolate instances', async () => {
  const f = fixture()
  const other = fixture()
  const start = await f.scope().start({ browser: 'one' })
  await expect(
    other.scope().callback(start.state, 'one', 'https://app.test/callback'),
  ).rejects.toThrow('AUTH_FAILED')
  expect(other.provider.exchange).not.toHaveBeenCalled()
  doubles.commit.mockResolvedValueOnce({ account: { id: 1, email: 'owner@example.com' } })
  doubles.session.mockImplementationOnce(async () => {
    await Promise.resolve()
    f.req.user = { id: 1 } as PayloadRequest['user']
    throw new Error('private native failure')
  })
  const callback = f.scope()
  await expect(callback.callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'private native failure',
  )
  expect(() => callback.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  expect(f.req.user).toBeUndefined()
  await expect(f.scope().callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'AUTH_FAILED',
  )
  expect(f.provider.exchange).toHaveBeenCalledTimes(1)
})
it('reauthentication denies a changed native principal after consuming state and restores the real req headers/user', async () => {
  const f = fixture()
  const account = {
    id: 1,
    email: 'owner@example.com',
    _verified: true,
    sessions: [{ id: 'sid', expiresAt: new Date(100000).toISOString() }],
  }
  f.req.user = {
    ...account,
    collection: publicConfig.collection,
    _sid: 'sid',
  } as PayloadRequest['user']
  Object.assign(f.db, { findOne: vi.fn(async () => account) })
  const auth = vi.fn(async () => ({
    user: { ...account, collection: publicConfig.collection, _sid: 'changed' },
  }))
  Object.assign(f.req.payload, { auth })
  const originalUser = f.req.user
  const originalHeaders = f.req.headers
  const start = await f.scope().start({ browser: 'one', purpose: 'reauth', popup: true })
  const callback = f.scope()
  await expect(callback.callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'AUTH_FAILED',
  )
  expect(auth.mock.calls[0][0].req).toBe(f.req)
  expect(f.req.user).toBe(originalUser)
  expect(f.req.headers).toBe(originalHeaders)
  expect(() => callback.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  await expect(f.scope().callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'AUTH_FAILED',
  )
  expect(f.provider.exchange).toHaveBeenCalledTimes(1)
})
it('account uniqueness rejection after exchange burns correlation without invoking native session or exposing receipt', async () => {
  const f = fixture()
  const sessionsBefore = doubles.session.mock.calls.length
  doubles.commit.mockImplementationOnce(async () => {
    await Promise.resolve()
    throw new Error('duplicate native subject')
  })
  const start = await f.scope().start({ browser: 'one' })
  const callback = f.scope()
  await expect(callback.callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'duplicate native subject',
  )
  expect(doubles.session.mock.calls.length).toBe(sessionsBefore)
  expect(() => callback.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  expect(f.req.user).toBeUndefined()
  await expect(f.scope().callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
    'AUTH_FAILED',
  )
  expect(f.provider.exchange).toHaveBeenCalledTimes(1)
})
it.each([
  {
    label: 'collection',
    collection: 'other',
    redirectURI: 'https://app.test/api/auth/oauth/google/callback',
  },
  {
    label: 'origin',
    collection: publicConfig.collection,
    redirectURI: 'https://other.test/api/auth/oauth/google/callback',
  },
])(
  'baseline epochs bind correlations to $label when scopes share the same durable store',
  async ({ collection, redirectURI }) => {
    const f = fixture()
    const start = await f.scope().start({ browser: 'one' })
    const other = createGoogleScope(
      f.req,
      { ...publicConfig, collection, googleOAuthEnabled: true },
      f.provider,
      redirectURI,
      () => 1000,
    )
    await expect(other.callback(start.state, 'one', 'https://app.test/callback')).rejects.toThrow(
      'AUTH_FAILED',
    )
    expect(f.provider.exchange).not.toHaveBeenCalled()
  },
)
