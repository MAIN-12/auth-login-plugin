import { expect, it, vi } from 'vitest'
import { createOwnershipPolicy } from '../src/auth/application/use-cases/ownership'

it('internal ownership callers reject disabled methods before constructing storage or delivery', async () => {
  const protocol = vi.fn()
  const nativeReauthenticate = vi.fn()
  const permits = { grant: vi.fn(), read: vi.fn() }
  const flow = createOwnershipPolicy({
    settings: { password: true, signup: false, recovery: false, otpReauthentication: false },
    principal: null,
    protocol,
    permits,
    commit: vi.fn(),
    nativeReauthenticate,
  })
  for (const purpose of ['signup', 'recovery', 'reauth'] as const) {
    await expect(flow.send({ email: 'owner@example.com', purpose }, 'peer')).rejects.toThrow(
      'METHOD_DISABLED',
    )
  }
  await expect(flow.reauthenticate({ password: 'legacy' })).rejects.toThrow('UNAUTHENTICATED')
  expect(protocol).not.toHaveBeenCalled()
  expect(nativeReauthenticate).not.toHaveBeenCalled()
  expect(permits.grant).not.toHaveBeenCalled()
})

it('portable ownership uses explicit credential evidence and binds a verified exact principal', async () => {
  const { createOwnershipVerification } =
    await import('../src/auth/application/use-cases/ownershipVerification')
  const { createOtpCodec } = await import('../src/auth/infrastructure/crypto/otpCodec')
  const { createOtpLedger } = await import('../src/auth/infrastructure/payload/otpLedger')
  const rows = new Map<string, Record<string, unknown>>()
  const deliver = vi.fn()
  const grant = vi.fn(async (proof) => proof)
  const flow = createOwnershipVerification({
    collection: 'customers',
    purpose: 'recovery',
    now: () => 1000,
    codec: createOtpCodec('s'.repeat(32)),
    ledger: createOtpLedger({
      transaction: async (_keys, work) =>
        work({
          get: async (key) => rows.get(key),
          put: async (key, value) => {
            rows.set(key, value)
          },
        }),
    }),
    random: () => '123456',
    context: () => 'a'.repeat(64),
    principal: null,
    findOwnershipAccount: async () => ({
      id: 1,
      email: 'owner@example.com',
      state: 'active',
      password: 'unknown',
      emailVerification: 'verified',
      version: 'opaque',
    }),
    deliver,
    grant,
    event: () => {},
  })
  const sent = await flow.send({ email: 'owner@example.com', purpose: 'recovery' }, 'peer')
  expect(deliver).not.toHaveBeenCalled()
  await expect(
    flow.verify({
      email: 'owner@example.com',
      purpose: 'recovery',
      context: sent.context,
      otp: '123456',
    }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(grant).not.toHaveBeenCalled()
})

it('direct password completion preserves the new-password policy and opaque permit expiry without credential effects on denial', async () => {
  const { createPasswordPermitCodec } =
    await import('../src/auth/infrastructure/crypto/passwordPermitCodec')
  let now = 1000
  const permits = createPasswordPermitCodec({
    collection: 'customers',
    secret: 's'.repeat(32),
    now: () => now,
  })
  const commit = vi.fn(async () => ({ success: true }))
  const flow = createOwnershipPolicy({
    settings: { password: true, signup: true, recovery: true, otpReauthentication: true },
    principal: null,
    protocol: vi.fn(),
    permits,
    commit,
    nativeReauthenticate: vi.fn(),
  })
  const grant = permits.grant({
    purpose: 'signup',
    email: 'owner@example.com',
    account: null,
    version: '',
  })
  for (const password of ['Mailcreated5240', '🦉'.repeat(8)])
    await expect(flow.complete('signup', { permit: grant.permit, password })).rejects.toThrow(
      'INVALID_INPUT',
    )
  await expect(
    flow.complete('recovery', { permit: grant.permit, password: 'a long owner chosen phrase' }),
  ).rejects.toThrow('AUTH_FAILED')
  now = 601000
  await expect(
    flow.complete('signup', { permit: grant.permit, password: 'a long owner chosen phrase' }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(commit).not.toHaveBeenCalled()
})
