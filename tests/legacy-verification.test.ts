import { expect, it } from 'vitest'
import { createOwnershipVerification } from '../src/auth/application/ownershipVerification'
import type { OtpStore } from '../src/auth/domain/otp'
it('legacy email ownership binds existing credential evidence without granting password or session authority', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  let granted: unknown
  const flow = createOwnershipVerification({ collection: 'customers', purpose: 'verify-email', secret: 's'.repeat(32), store, random: () => '123456', context: () => 'a'.repeat(64), findOwnershipAccount: async () => ({ id: 7, email: 'owner@example.com', hash: 'original-hash', salt: 'original-salt' }), credentialVersion: () => 'original-version', principal: null, deliver: async () => {}, event: () => {}, grant: async proof => { granted = proof; return { success: true } } })
  const sent = await flow.send({ email: 'owner@example.com', purpose: 'verify-email' }, 'peer')
  expect(await flow.verify({ email: 'owner@example.com', purpose: 'verify-email', context: sent.context, otp: '123456' })).toEqual({ success: true })
  expect(granted).toEqual({ purpose: 'verify-email', email: 'owner@example.com', account: 7, version: 'original-version' })
  await expect(flow.verify({ email: 'owner@example.com', purpose: 'verify-email', context: sent.context, otp: '123456' })).rejects.toThrow('AUTH_FAILED')
})
it('legacy ownership expiry and purpose separation cannot authorize password completion', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  let now = 1000
  const flow = createOwnershipVerification({ collection: 'customers', purpose: 'verify-email', secret: 's'.repeat(32), store, now: () => now, ttlSeconds: 60, random: () => '123456', context: () => 'a'.repeat(64), findOwnershipAccount: async () => ({ id: 7, email: 'owner@example.com' }), credentialVersion: () => 'unknown-native-version', principal: null, deliver: async () => {}, event: () => {}, grant: async () => ({ success: true }) })
  const sent = await flow.send({ email: 'owner@example.com', purpose: 'verify-email' }, 'peer')
  await expect(flow.verify({ email: 'owner@example.com', purpose: 'recovery', context: sent.context, otp: '123456' })).rejects.toThrow('INVALID_INPUT')
  now = 61000
  await expect(flow.verify({ email: 'owner@example.com', purpose: 'verify-email', context: sent.context, otp: '123456' })).rejects.toThrow('AUTH_FAILED')
})
