import { afterEach, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createRefreshScope } from '../src/auth/composition/session'
import {
  getAuthenticationEvidence,
  setAuthenticationEvidence,
} from '../src/auth/infrastructure/payload/adminPolicy'

afterEach(() => vi.restoreAllMocks())
it.each(['success', 'reject'] as const)(
  'uses the exact native refresh request and cleans evidence on %s without retrying hooks',
  async (mode) => {
    const req = {
      headers: new Headers(),
      user: { id: 1, collection: 'customers', _sid: 'sid' },
      payload: { collections: { customers: {} } },
    } as unknown as PayloadRequest
    setAuthenticationEvidence(req, { method: 'password' })
    const native = vi.fn(async ({ req: actual }: { req: PayloadRequest }) => {
      expect(actual).toBe(req)
      if (mode === 'reject') throw new Error('private failure')
      return { exp: 2000, refreshedToken: 'private-token', user: { id: 1 }, setCookie: true }
    })
    const scope = createRefreshScope('customers', req, native as never)
    expect(await scope.refresh()).toEqual(
      mode === 'success'
        ? { ok: true, value: { expiresAt: 2000 } }
        : { ok: false, code: 'AUTH_UNAVAILABLE' },
    )
    if (mode === 'success') expect(scope.takeReceipt().refreshedToken).toBe('private-token')
    scope.dispose()
    expect(getAuthenticationEvidence(req)).toBeUndefined()
    expect(await scope.refresh()).toEqual({ ok: false, code: 'AUTH_UNAVAILABLE' })
    expect(native).toHaveBeenCalledTimes(1)
  },
)

import { createSessionPolicy } from '../src/auth/infrastructure/payload/sessionPolicy'
it('caps native refresh at original creation even after a later sliding expiry', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000000)
  const req = {
    user: { id: 1, collection: 'customers', _sid: 'sid' },
    context: {},
    payload: {
      db: {
        findOne: async () => ({
          sessions: [{ id: 'sid', createdAt: new Date(950000), expiresAt: new Date(1200000) }],
        }),
      },
    },
  } as unknown as PayloadRequest
  const collection = { config: { auth: { tokenExpiration: 100 }, slug: 'customers' } }
  const args = { collection, req }
  const policy = createSessionPolicy('customers', 100)
  const changed = await policy.beforeOperation({ operation: 'refresh', req, args } as never)
  expect(changed).toMatchObject({ collection: { config: { auth: { tokenExpiration: 50 } } } })
  expect(collection.config.auth.tokenExpiration).toBe(100)
})
it.each([
  [],
  [{ id: 'sid', createdAt: new Date(800000), expiresAt: new Date(1200000) }],
  [{ id: 'sid', createdAt: new Date(950000), expiresAt: new Date(990000) }],
  [{ id: 'sid', createdAt: 'malformed', expiresAt: new Date(1200000) }],
  { id: 'sid' },
])('fails closed for revoked, expired or malformed native sessions %j', async (sessions) => {
  vi.spyOn(Date, 'now').mockReturnValue(1000000)
  const req = {
    user: { id: 1, collection: 'customers', _sid: 'sid' },
    payload: { db: { findOne: async () => ({ sessions }) } },
  } as unknown as PayloadRequest
  await expect(
    createSessionPolicy('customers', 100).beforeOperation({
      operation: 'refresh',
      req,
      args: {},
    } as never),
  ).rejects.toThrow('AUTH_FAILED')
})
it.each([
  ['REST', true, true, false],
  ['GraphQL', true, true, false],
  ['local', false, true, false],
  ['local', true, false, false],
  ['local', true, true, true],
] as const)(
  'requires local origin, overrideAccess and explicit context together (%s/%s/%s)',
  async (payloadAPI, overrideAccess, context, allowed) => {
    const req = {
      payloadAPI,
      context: { authLoginCredentialProvisioning: context },
      headers: new Headers({ cookie: 'authLoginCredentialProvisioning=true' }),
    } as unknown as PayloadRequest
    const args = {
      data: { email: 'new@example.test', password: 'private-password', _verified: true },
      overrideAccess,
    }
    const promise = createSessionPolicy('customers', 100).beforeOperation({
      operation: 'update',
      req,
      args,
    } as never)
    if (allowed) expect(await promise).toBe(args)
    else await expect(promise).rejects.toThrow('METHOD_DISABLED')
  },
)

it('rejects a native refresh redirected to another principal and never releases its token', async () => {
  const req = {
    headers: new Headers(),
    user: { id: 1, collection: 'customers', _sid: 'sid' },
    payload: { collections: { customers: {} } },
  } as unknown as PayloadRequest
  const native = vi.fn(async () => {
    req.user = { id: 2, collection: 'customers', _sid: 'other' } as PayloadRequest['user']
    return { exp: 2000, refreshedToken: 'foreign-token', user: { id: 2 } }
  })
  const scope = createRefreshScope('customers', req, native as never)
  expect(await scope.refresh()).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(() => scope.takeReceipt()).toThrow('AUTH_UNAVAILABLE')
  scope.dispose()
})

it.each(['success', 'reject'] as const)(
  'clears evidence at its original binding when native hooks replace headers on %s',
  async (mode) => {
    const headers = new Headers()
    const req = {
      headers,
      user: { id: 1, collection: 'customers', _sid: 'sid' },
      payload: { collections: { customers: {} } },
    } as unknown as PayloadRequest
    setAuthenticationEvidence(req, { method: 'password' })
    const native = vi.fn(async () => {
      req.headers = new Headers()
      if (mode === 'reject') throw new Error('hook failure')
      return { exp: 2000, refreshedToken: 'private-token', user: { id: 1 } }
    })
    const scope = createRefreshScope('customers', req, native as never)
    expect((await scope.refresh()).ok).toBe(false)
    scope.dispose()
    req.headers = headers
    expect(getAuthenticationEvidence(req)).toBeUndefined()
  },
)
