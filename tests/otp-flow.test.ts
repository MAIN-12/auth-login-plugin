import { expect, it } from 'vitest'
import { createOtpFlow, type OtpStore } from '../src/auth/domain/otp'

const fixture = () => {
  let now = 1_000_000
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  const mail: string[] = []
  const flow = createOtpFlow({ collection: 'customers', secret: 'a'.repeat(32), store, now: () => now, random: () => '123456', context: () => 'a'.repeat(64), findAccount: async email => email === 'user@example.com' ? 'user-1' : null, deliver: async ({ code }) => { mail.push(code) }, session: async id => ({ id }), event: () => {} })
  return { flow, mail, tick: (ms: number) => { now += ms } }
}
it('SendOtp and VerifyOtp authorize an existing account once without passwords', async () => {
  const { flow, mail } = fixture()
  const sent = await flow.send({ email: 'USER@example.com', purpose: 'login' }, 'trusted-peer')
  expect(mail).toEqual(['123456'])
  expect(await flow.verify({ email: 'user@example.com', purpose: 'login', context: sent.context, otp: '123456' })).toEqual({ id: 'user-1' })
  await expect(flow.verify({ email: 'user@example.com', purpose: 'login', context: sent.context, otp: '123456' })).rejects.toThrow('AUTH_FAILED')
})
it('resends preserve code, expiry and exhausted attempts, without claiming delivery', async () => {
  const { flow, mail, tick } = fixture()
  const sent = await flow.send({ email: 'user@example.com', purpose: 'login' }, 'peer')
  const verify = (otp: string) => flow.verify({ email: 'user@example.com', purpose: 'login', context: sent.context, otp })
  await expect(verify('000000')).rejects.toThrow('AUTH_FAILED')
  tick(60_000)
  expect(await flow.send({ email: 'user@example.com', purpose: 'login', context: sent.context }, 'peer')).toEqual(sent)
  expect(mail).toEqual(['123456', '123456'])
  await expect(verify('000000')).rejects.toThrow('AUTH_FAILED')
  await expect(verify('000000')).rejects.toThrow('AUTH_FAILED')
  tick(60_000)
  await flow.send({ email: 'user@example.com', purpose: 'login', context: sent.context }, 'peer')
  await expect(verify('123456')).rejects.toThrow('AUTH_FAILED')
  tick(180_000)
  await expect(verify('123456')).rejects.toThrow('AUTH_FAILED')
})
it('account-independent contracts survive mail failure and reject origin or binding substitution', async () => {
  const { flow } = fixture()
  const known = await flow.send({ email: 'user@example.com', purpose: 'login' }, 'peer')
  const unknown = await flow.send({ email: 'missing@example.com', purpose: 'login' }, 'peer')
  expect(unknown).toEqual(known)
  await expect(flow.send({ email: 'user@example.com', purpose: 'login' }, null)).rejects.toThrow('AUTH_UNAVAILABLE')
  await expect(flow.verify({ email: 'user@example.com', purpose: 'login', context: 'b'.repeat(64), otp: '123456' })).rejects.toThrow('AUTH_FAILED')
  await expect(flow.verify({ email: 'user@example.com', purpose: 'password-reset', context: known.context, otp: '123456' })).rejects.toThrow('INVALID_INPUT')
})
it('storage failures deny access and failed delivery neither resets budgets nor claims receipt', async () => {
  let now = 0
  const rows = new Map<string, Record<string, unknown>>()
  let failedStorage = false
  const events: string[] = []
  let deliveries = 0
  const flow = createOtpFlow({ collection: 'customers', secret: 'z'.repeat(32), now: () => now, random: () => '654321', context: () => 'c'.repeat(64), store: { transaction: async (_keys, work) => { if (failedStorage) throw new Error('private db exception'); return work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) } }, findAccount: async () => 'account', deliver: async () => { deliveries++; throw new Error('private smtp exception') }, session: async () => { throw new Error('denied hook') }, event: kind => { events.push(kind) } })
  const sent = await flow.send({ email: 'user@example.com', purpose: 'login' }, 'peer')
  expect(sent.code).toBe('OTP_REQUEST_ACCEPTED')
  expect(events).toEqual(['mail_failed'])
  await flow.send({ email: 'user@example.com', purpose: 'login', context: sent.context }, 'peer')
  expect(deliveries).toBe(1)
  now = 60_000
  await flow.send({ email: 'user@example.com', purpose: 'login', context: sent.context }, 'peer')
  expect(deliveries).toBe(2)
  failedStorage = true
  await expect(flow.verify({ email: 'user@example.com', purpose: 'login', context: sent.context, otp: '654321' })).rejects.toThrow('AUTH_UNAVAILABLE')
  failedStorage = false
  await expect(flow.verify({ email: 'user@example.com', purpose: 'login', context: sent.context, otp: '654321' })).rejects.toThrow('AUTH_FAILED')
  await expect(flow.verify({ email: 'user@example.com', purpose: 'login', context: sent.context, otp: '654321' })).rejects.toThrow('AUTH_FAILED')
})
it('an issued login proof cannot authorize a replacement account with the same email', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  let account = 'account-A'
  const flow = createOtpFlow({ collection: 'customers', secret: 's'.repeat(32), store, random: () => '123456', context: () => 'a'.repeat(64), findAccount: async () => account, deliver: async () => {}, session: async id => ({ id }), event: () => {} })
  const sent = await flow.send({ email: 'same@example.com', purpose: 'login' }, 'peer')
  account = 'account-B'
  await expect(flow.verify({ email: 'same@example.com', purpose: 'login', context: sent.context, otp: '123456' })).rejects.toThrow('AUTH_FAILED')
})
it('login proofs cannot cross target collections sharing email, store and secret', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  const options = { secret: 's'.repeat(32), store, random: () => '123456', context: () => 'a'.repeat(64), findAccount: async () => 'account-A', deliver: async () => {}, session: async id => ({ id }), event: () => {} }
  const customers = createOtpFlow({ ...options, collection: 'customers' })
  const employees = createOtpFlow({ ...options, collection: 'employees' })
  const sent = await customers.send({ email: 'same@example.com', purpose: 'login' }, 'peer')
  await expect(employees.verify({ email: 'same@example.com', purpose: 'login', context: sent.context, otp: '123456' })).rejects.toThrow('AUTH_FAILED')
})
it('the durable account emission quota survives email changes', async () => {
  const rows = new Map<string, Record<string, unknown>>()
  const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }) }
  let now = 0
  let deliveries = 0
  const flow = createOtpFlow({ collection: 'customers', secret: 's'.repeat(32), store, now: () => now, random: () => '123456', context: () => 'a'.repeat(64), accountLimit: 1, cooldownSeconds: 1, findAccount: async () => 'same-durable-account', deliver: async () => { deliveries++ }, session: async id => ({ id }), event: () => {} })
  await flow.send({ email: 'before@example.com', purpose: 'login' }, 'peer')
  now += 1001
  await flow.send({ email: 'after@example.com', purpose: 'login' }, 'peer')
  expect(deliveries).toBe(1)
})
