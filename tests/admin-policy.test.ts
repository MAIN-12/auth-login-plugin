import { expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createAdminPolicy, setAuthenticationEvidence } from '../src/auth/server/adminPolicy'

it.each(['false', 'throw'] as const)('original Admin %s denies every composed administrative operation independently of explicit authorization', async mode => {
  const req = { payload: {}, headers: new Headers(), user: { id: 1, _sid: 'native-session', collection: 'customers' } } as PayloadRequest
  setAuthenticationEvidence(req, { method: 'password', authenticatedAt: Date.now() })
  const policy = createAdminPolicy({ authorize: () => true, collections: [] }, async () => { if (mode === 'throw') throw new Error('consumer unavailable'); return false })
  expect(await policy.permits(req)).toBe(false)
  expect(await policy.compose(() => true)({ req })).toBe(false)
})

it('runs original eligibility exactly once for the shared UI/resource decision', async () => {
  const req = { payload: {}, headers: new Headers(), user: { id: 2, _sid: 'native-session', collection: 'customers' } } as PayloadRequest
  setAuthenticationEvidence(req, { method: 'password' })
  let calls = 0
  const policy = createAdminPolicy({ authorize: () => true, collections: [] }, () => { calls++; return true })
  expect(await policy.compose(() => true)({ req })).toBe(true)
  expect(calls).toBe(1)
})
