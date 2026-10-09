import { expect, it } from 'vitest'
import { createOwnershipPolicy } from '../src/auth/application/use-cases/ownership'
import { createPasswordPermitCodec } from '../src/auth/infrastructure/crypto/passwordPermitCodec'
import type { PasswordPermit } from '../src/auth/domain/passwordPermit'
import type { CredentialCommit } from '../src/auth/application/ports/ownership'
function fixture(options: {
  secret: string
  collection: string
  now?: () => number
  signup: boolean
  recovery: boolean
  password: boolean
  commit: CredentialCommit
}) {
  const codec = createPasswordPermitCodec(options)
  const policy = createOwnershipPolicy({
    settings: { ...options, otpReauthentication: false },
    principal: { id: 1, sid: 'current' },
    permits: codec,
    commit: options.commit,
    protocol: async () => {
      throw new Error('unused')
    },
    nativeReauthenticate: async () => {
      throw new Error('unused')
    },
  })
  return {
    complete: policy.complete,
    grant(permit: PasswordPermit) {
      policy.admitMethod(permit.purpose, false)
      return codec.grant(permit)
    },
  }
}

it('Signup establishes only an owner-chosen phrase after verification, never pre-registers credentials', async () => {
  const writes: unknown[] = []
  const flow = fixture({
    secret: 's'.repeat(32),
    collection: 'customers',
    now: () => 1000,
    signup: true,
    recovery: true,
    password: true,
    commit: async (permit, password) => {
      writes.push({ permit, password })
      return { success: true }
    },
  })
  await expect(
    flow.complete('signup', { email: 'other@example.com', password: 'attacker password' }),
  ).rejects.toThrow('INVALID_INPUT')
  expect(writes).toEqual([])
  const grant = flow.grant({
    purpose: 'signup',
    email: 'owner@example.com',
    account: null,
    version: '',
  })
  expect(grant.expiresAt).toBe(601000)
  expect(
    await flow.complete('signup', {
      permit: grant.permit,
      password: '  The River Carries Quiet Dreams  ',
    }),
  ).toEqual({ success: true })
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ password: '  The River Carries Quiet Dreams  ' })
})
it('a limited recovery grant is opaque, purpose-bound, expires at ten minutes and rejects weak passwords', async () => {
  let now = 1000
  let calls = 0
  const flow = fixture({
    secret: 's'.repeat(32),
    collection: 'customers',
    now: () => now,
    signup: true,
    recovery: true,
    password: true,
    commit: async () => {
      calls++
      return { success: true }
    },
  })
  const grant = flow.grant({
    purpose: 'recovery',
    email: 'owner@example.com',
    account: 1,
    version: 'credential-evidence',
  })
  expect(Buffer.from(grant.permit.split('.')[0], 'base64url').toString()).not.toContain(
    'owner@example.com',
  )
  await expect(
    flow.complete('signup', { permit: grant.permit, password: 'the river carries quiet dreams' }),
  ).rejects.toThrow('AUTH_FAILED')
  await expect(
    flow.complete('recovery', { permit: grant.permit, password: 'short' }),
  ).rejects.toThrow('INVALID_INPUT')
  now = 601000
  await expect(
    flow.complete('recovery', { permit: grant.permit, password: 'the river carries quiet dreams' }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(calls).toBe(0)
})
it.each(['momsanaladventure', 'MOMSANALADVENTURE', 'MomsAnalAdventure'])(
  'new passwords reject case variants of a long compromised corpus entry: %s',
  async (password) => {
    const writes: unknown[] = []
    const flow = fixture({
      secret: 's'.repeat(32),
      collection: 'customers',
      signup: true,
      recovery: false,
      password: true,
      commit: async (permit, credential) => {
        writes.push({ permit, credential })
        return { success: true }
      },
    })
    const grant = flow.grant({
      purpose: 'signup',
      email: 'owner@example.com',
      account: null,
      version: '',
    })
    await expect(flow.complete('signup', { permit: grant.permit, password })).rejects.toThrow(
      'INVALID_INPUT',
    )
    expect(writes).toEqual([])
  },
)
it('new passwords reject the versioned compromised corpus and count Unicode characters, not artificial composition', async () => {
  const writes: string[] = []
  const flow = fixture({
    secret: 's'.repeat(32),
    collection: 'customers',
    signup: true,
    recovery: false,
    password: true,
    commit: async (_permit, credential) => {
      writes.push(credential)
      return { success: true }
    },
  })
  const grant = flow.grant({
    purpose: 'signup',
    email: 'owner@example.com',
    account: null,
    version: '',
  })
  await expect(
    flow.complete('signup', { permit: grant.permit, password: 'Mailcreated5240' }),
  ).rejects.toThrow('INVALID_INPUT')
  await expect(
    flow.complete('signup', { permit: grant.permit, password: '🦉'.repeat(8) }),
  ).rejects.toThrow('INVALID_INPUT')
  expect(
    await flow.complete('signup', {
      permit: grant.permit,
      password: 'a long lowercase quiet phrase',
    }),
  ).toEqual({ success: true })
  expect(writes).toEqual(['a long lowercase quiet phrase'])
})
it('reauthentication is limited to five minutes, one collection and the selected method', async () => {
  let now = 1000
  const options = {
    secret: 's'.repeat(32),
    signup: false,
    recovery: false,
    password: true,
    now: () => now,
    commit: async () => ({ success: true }),
  }
  const flow = fixture({ ...options, collection: 'customers' })
  const permit = flow.grant({
    purpose: 'reauth',
    email: 'owner@example.com',
    account: 1,
    version: 'proof',
    sid: 'current',
  })
  expect(permit.expiresAt).toBe(301000)
  await expect(
    fixture({ ...options, collection: 'admins' }).complete('reauth', {
      permit: permit.permit,
      password: 'a long lowercase quiet phrase',
    }),
  ).rejects.toThrow('AUTH_FAILED')
  now = 301000
  await expect(
    flow.complete('reauth', { permit: permit.permit, password: 'a long lowercase quiet phrase' }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(() =>
    fixture({ ...options, collection: 'customers', password: false }).grant({
      purpose: 'reauth',
      email: 'owner@example.com',
      account: 1,
      version: 'proof',
    }),
  ).toThrow('METHOD_DISABLED')
})
