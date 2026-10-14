import { expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import {
  createAdminPolicy,
  setAuthenticationEvidence,
} from '../src/collections/ConfiguredAuthCollection/infrastructure/payload/adminPolicy'

it.each(['false', 'throw'] as const)(
  'original Admin %s denies every composed administrative operation independently of explicit authorization',
  async (mode) => {
    const req = {
      payload: {},
      headers: new Headers(),
      user: { id: 1, _sid: 'native-session', collection: 'customers' },
    } as PayloadRequest
    setAuthenticationEvidence(req, { method: 'password', authenticatedAt: Date.now() })
    const policy = createAdminPolicy({ authorize: () => true, collections: [] }, async () => {
      if (mode === 'throw') throw new Error('consumer unavailable')
      return false
    })
    expect(await policy.permits(req)).toBe(false)
    expect(await policy.compose(() => true)({ req })).toBe(false)
  },
)

it('runs original eligibility exactly once for the shared UI/resource decision', async () => {
  const req = {
    payload: {},
    headers: new Headers(),
    user: { id: 2, _sid: 'native-session', collection: 'customers' },
  } as PayloadRequest
  setAuthenticationEvidence(req, { method: 'password' })
  let calls = 0
  const policy = createAdminPolicy({ authorize: () => true, collections: [] }, () => {
    calls++
    return true
  })
  expect(await policy.compose(() => true)({ req })).toBe(true)
  expect(calls).toBe(1)
})

it('fails closed when a protected resource policy rejects asynchronously', async () => {
  const req = {
    payload: {},
    headers: new Headers(),
    user: { id: 2, _sid: 'native-session', collection: 'customers' },
  } as PayloadRequest
  setAuthenticationEvidence(req, { method: 'password' })
  const policy = createAdminPolicy({ authorize: () => true, collections: [] }, () => true)
  expect(
    await policy.compose(async () => {
      throw new Error('host failure')
    })({ req }),
  ).toBe(false)
})

it('denies client flags without native proof and a principal changed during host authorization', async () => {
  const req = {
    payload: {},
    headers: new Headers(),
    user: {
      id: 2,
      _sid: 'native-session',
      collection: 'customers',
      _verified: true,
      authLoginMethod: 'password',
    },
    context: { authorizeAdmin: true },
  } as unknown as PayloadRequest
  const policy = createAdminPolicy({ authorize: () => true, collections: [] }, () => true)
  expect(await policy.permits(req)).toBe(false)
  setAuthenticationEvidence(req, { method: 'google' })
  const changing = createAdminPolicy(
    {
      authorize: async () => {
        await Promise.resolve()
        req.user = {
          id: 3,
          _sid: 'other-session',
          collection: 'customers',
        } as PayloadRequest['user']
        return true
      },
      collections: [],
    },
    () => true,
  )
  expect(await changing.permits(req)).toBe(false)
})

it.each(['password', 'otp', 'google'] as const)(
  'authorizes an existing superadmin by host permissions independently of %s authentication',
  async (method) => {
    const req = {
      payload: {},
      headers: new Headers(),
      user: { id: 1, _sid: 'native-session', collection: 'customers', role: 'superadmin' },
    } as unknown as PayloadRequest
    setAuthenticationEvidence(req, { method })
    const authorize = ({ req }: { req: PayloadRequest }) => req.user?.role === 'superadmin'
    const policy = createAdminPolicy({ authorize, collections: [] }, () => true)
    expect(await policy.permits(req)).toBe(true)
    expect(await policy.compose(() => ({ owner: { equals: 1 } }))({ req })).toEqual({
      owner: { equals: 1 },
    })
    expect(await policy.compose(() => false)({ req })).toBe(false)
    expect(await createAdminPolicy({ authorize, collections: [] }, () => false).permits(req)).toBe(
      false,
    )
    expect(
      await createAdminPolicy({ authorize: () => false, collections: [] }, () => true).permits(req),
    ).toBe(false)
    expect(await createAdminPolicy(undefined, () => true).permits(req)).toBe(false)
    req.user!.role = 'member'
    expect(await policy.permits(req)).toBe(false)
  },
)
