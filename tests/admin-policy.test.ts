import { expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createAdminPolicy, setAuthenticationEvidence } from '../src/auth/server/adminPolicy'

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

it('denies client flags, ownership/OTP alone and a principal changed during host authorization', async () => {
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
  setAuthenticationEvidence(req, { method: 'otp' })
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
