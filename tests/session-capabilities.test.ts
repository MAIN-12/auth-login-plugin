import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { readCredentialCapabilities } from '../src/auth/server/credentialEvidence'

it('keeps omitted credentials unknown and never exposes storage secrets', async () => {
  const req = {
    user: { id: 7, collection: 'customers' },
    payload: { db: { findOne: vi.fn(async () => ({ _verified: true, password: 'secret' })) } },
  } as unknown as PayloadRequest
  expect(await readCredentialCapabilities(req, 'customers')).toEqual({
    password: 'unknown',
    emailVerification: 'verified',
  })
})

import { createCapabilitiesScope } from '../src/auth/composition/session'

it('binds own capabilities to the authenticated request and rejects a changed principal', async () => {
  let resolve!: (value: object) => void
  const findOne = vi.fn(
    () =>
      new Promise<object>((r) => {
        resolve = r
      }),
  )
  const req = {
    user: { id: 7, collection: 'customers' },
    headers: new Headers(),
    payload: { db: { findOne } },
  } as unknown as PayloadRequest
  const scope = createCapabilitiesScope('customers', req)
  const pending = scope.capabilities()
  req.user = { id: 8, collection: 'customers' } as PayloadRequest['user']
  resolve({ hash: 'private-hash', salt: 'private-salt', _verified: true })
  expect(await pending).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
  expect(findOne).toHaveBeenCalledWith({
    collection: 'customers',
    req,
    where: { id: { equals: 7 } },
    select: { hash: true, salt: true, _verified: true },
  })
  scope.dispose()
  expect(await scope.capabilities()).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
})

it.each([
  [null, 'unknown', 'unknown'],
  [{ hash: null, salt: null, _verified: false }, 'unavailable', 'unverified'],
  [{ hash: 'secret', salt: 'salt', _verified: true }, 'available', 'verified'],
  [{ hash: false, salt: 'salt', _verified: 'true' }, 'unknown', 'unknown'],
  [{ hash: '', salt: '' }, 'unknown', 'unknown'],
] as const)(
  'returns only explicit capabilities for storage evidence %j',
  async (record, password, emailVerification) => {
    const req = {
      user: { id: 1, collection: 'customers' },
      payload: { db: { findOne: async () => record } },
    } as unknown as PayloadRequest
    expect(await createCapabilitiesScope('customers', req).capabilities()).toEqual({
      ok: true,
      value: { password, emailVerification },
    })
  },
)

it('does not read storage for anonymous or foreign collection principals', async () => {
  const findOne = vi.fn()
  for (const user of [null, { id: 1, collection: 'admins' }]) {
    const req = { user, payload: { db: { findOne } } } as unknown as PayloadRequest
    expect(await createCapabilitiesScope('customers', req).capabilities()).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    })
  }
  expect(findOne).not.toHaveBeenCalled()
})

import { createCapabilitiesEndpoint } from '../src/auth/composition/session'
import { publicConfig } from './auth-test-config'
it('ignores caller account/collection selectors and returns safe HTTP evidence for only its own principal', async () => {
  const findOne = vi.fn(async () => ({
    hash: 'private-hash',
    salt: 'private-salt',
    _verified: true,
    password: 'private-password',
  }))
  const req = {
    user: { id: 7, collection: 'users' },
    headers: new Headers(),
    json: vi.fn(async () => ({ id: 8, collection: 'admins', user: { id: 8 } })),
    payload: { config: { cors: [] }, db: { findOne } },
  } as unknown as PayloadRequest
  const response = await createCapabilitiesEndpoint(publicConfig).handler(req)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    capabilities: { password: 'available', emailVerification: 'verified' },
  })
  expect(findOne).toHaveBeenCalledWith(
    expect.objectContaining({ collection: 'users', where: { id: { equals: 7 } } }),
  )
  expect(req.json).not.toHaveBeenCalled()
})
it('returns a safe unavailable response when the capability storage rejects', async () => {
  const req = {
    user: { id: 7, collection: 'users' },
    headers: new Headers(),
    payload: {
      config: { cors: [] },
      db: {
        findOne: async () => {
          throw new Error('private-storage-secret')
        },
      },
    },
  } as unknown as PayloadRequest
  const response = await createCapabilitiesEndpoint(publicConfig).handler(req)
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ success: false, code: 'AUTH_UNAVAILABLE' })
})
