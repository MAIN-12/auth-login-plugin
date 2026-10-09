import { createOtpCodec } from '../src/auth/infrastructure/crypto/otpCodec'
import { createOtpLedger } from '../src/auth/infrastructure/payload/otpLedger'
import { mapOwnershipAccount } from '../src/auth/server/ownershipAccount'
import { expect, it } from 'vitest'
import { createOwnershipVerification } from '../src/auth/application/use-cases/ownershipVerification'
import type { OtpStore } from '../src/auth/infrastructure/payload/otpLedger'
it('legacy email ownership binds existing credential evidence without granting password or session authority', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = {
    transaction: async (_keys, work) =>
      work({
        get: async (key) => rows.get(key),
        put: async (key, value) => {
          rows.set(key, value)
        },
      }),
  }
  let granted: unknown
  const flow = createOwnershipVerification({
    collection: 'customers',
    purpose: 'verify-email',
    codec: createOtpCodec('s'.repeat(32)),
    ledger: createOtpLedger(store),
    now: Date.now,
    random: () => '123456',
    context: () => 'a'.repeat(64),
    findOwnershipAccount: async () =>
      mapOwnershipAccount(
        { id: 7, email: 'owner@example.com', hash: 'original-hash', salt: 'original-salt' },
        'original-version',
      ),
    principal: null,
    deliver: async () => {},
    event: () => {},
    grant: async (proof) => {
      granted = proof
      return { success: true }
    },
  })
  const sent = await flow.send({ email: 'owner@example.com', purpose: 'verify-email' }, 'peer')
  expect(
    await flow.verify({
      email: 'owner@example.com',
      purpose: 'verify-email',
      context: sent.context,
      otp: '123456',
    }),
  ).toEqual({ success: true })
  expect(granted).toEqual({
    purpose: 'verify-email',
    email: 'owner@example.com',
    account: 7,
    version: 'original-version',
  })
  await expect(
    flow.verify({
      email: 'owner@example.com',
      purpose: 'verify-email',
      context: sent.context,
      otp: '123456',
    }),
  ).rejects.toThrow('AUTH_FAILED')
})
it('legacy ownership expiry and purpose separation cannot authorize password completion', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = {
    transaction: async (_keys, work) =>
      work({
        get: async (key) => rows.get(key),
        put: async (key, value) => {
          rows.set(key, value)
        },
      }),
  }
  let now = 1000
  const flow = createOwnershipVerification({
    collection: 'customers',
    purpose: 'verify-email',
    codec: createOtpCodec('s'.repeat(32)),
    ledger: createOtpLedger(store),
    now: () => now,
    ttlSeconds: 60,
    random: () => '123456',
    context: () => 'a'.repeat(64),
    findOwnershipAccount: async () =>
      mapOwnershipAccount({ id: 7, email: 'owner@example.com' }, 'unknown-native-version'),
    principal: null,
    deliver: async () => {},
    event: () => {},
    grant: async () => ({ success: true }),
  })
  const sent = await flow.send({ email: 'owner@example.com', purpose: 'verify-email' }, 'peer')
  await expect(
    flow.verify({
      email: 'owner@example.com',
      purpose: 'recovery',
      context: sent.context,
      otp: '123456',
    }),
  ).rejects.toThrow('INVALID_INPUT')
  now = 61000
  await expect(
    flow.verify({
      email: 'owner@example.com',
      purpose: 'verify-email',
      context: sent.context,
      otp: '123456',
    }),
  ).rejects.toThrow('AUTH_FAILED')
})
