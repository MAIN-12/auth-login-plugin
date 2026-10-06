import { expect, it } from 'vitest'
import { createOwnershipVerification, type OwnershipAccount } from '../src/auth/application/ownershipVerification'
import type { OtpStore } from '../src/auth/domain/otp'
function fixture(purpose: 'signup' | 'recovery' | 'reauth', account: OwnershipAccount | null, principal: { id: number; sid: string } | null = null) {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  const mail: string[] = []
  const flow = createOwnershipVerification({ collection: 'customers', purpose, secret: 's'.repeat(32), store, random: () => '123456', context: () => 'a'.repeat(64), findOwnershipAccount: async () => account,
    credentialVersion: () => 'native-proof-version', principal, deliver: async ({ code }) => { mail.push(code) }, event: () => {}, grant: async permit => permit,
  })
  return { flow, mail }
}
it('ownership recovery cannot grant a password to missing, deleted, passwordless or unknown native credential state', async () => {
  for (const account of [null, { id: 1, email: 'owner@example.com', deleted: true, hash: 'hash', salt: 'salt' }, { id: 1, email: 'owner@example.com' }, { id: 1, email: 'owner@example.com', hash: 'hash' }]) {
    const { flow, mail } = fixture('recovery', account)
    const sent = await flow.send({ email: 'owner@example.com', purpose: 'recovery' }, 'trusted-peer')
    expect(mail).toEqual([])
    await expect(flow.verify({ email: 'owner@example.com', purpose: 'recovery', context: sent.context, otp: '123456' })).rejects.toThrow('AUTH_FAILED')
  }
})
it('email reauthentication requires a verified exact principal and binds its existing SID, including explicit password addition', async () => {
  const { flow, mail } = fixture('reauth', { id: 1, email: 'owner@example.com', verified: true }, { id: 1, sid: 'native-current-sid' })
  const sent = await flow.send({ email: 'owner@example.com', purpose: 'reauth' }, 'trusted-peer')
  expect(mail).toEqual(['123456'])
  expect(await flow.verify({ email: 'owner@example.com', purpose: 'reauth', context: sent.context, otp: '123456' })).toEqual({ purpose: 'reauth', email: 'owner@example.com', account: 1, version: 'native-proof-version', sid: 'native-current-sid' })
  for (const [account, principal] of [[{ id: 2, email: 'owner@example.com', verified: true }, { id: 1, sid: 'sid' }], [{ id: 1, email: 'owner@example.com' }, { id: 1, sid: 'sid' }]] as const) {
    const denied = fixture('reauth', account, principal)
    await denied.flow.send({ email: 'owner@example.com', purpose: 'reauth' }, 'trusted-peer')
    expect(denied.mail).toEqual([])
  }
})
