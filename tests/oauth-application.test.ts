import { expect, it } from 'vitest'
import { createGoogleFlow } from '../src/auth/application/googleFlow'
import type { OtpStore } from '../src/auth/domain/otp'
const records = new Map<string, Record<string, unknown>>()
const store: OtpStore = { transaction: async (_keys, work) => work({ get: async key => records.get(key), put: async (key, value) => { records.set(key, value) } }) }
it('burns callback correlation once and never accepts another browser', async () => {
  let calls = 0
  const flow = createGoogleFlow({ store, now: () => 1000, authorize: async () => 'https://accounts.google.com/authorize', exchange: async () => ({ sub: 'stable', email: 'a@example.com', emailVerified: true }), finish: async () => { calls++; return 'session' } })
  const start = await flow.start({ browser: 'browser-one', returnTo: '/dashboard?q=1#ok' })
  await expect(flow.callback(start.state, 'browser-two', 'https://app.test/callback')).rejects.toThrow('AUTH_FAILED')
  expect(await flow.callback(start.state, 'browser-one', 'https://app.test/callback')).toEqual({ result: 'session', returnTo: '/dashboard?q=1#ok' })
  await expect(flow.callback(start.state, 'browser-one', 'https://app.test/callback')).rejects.toThrow('AUTH_FAILED')
  expect(calls).toBe(1)
})
it('expires correlation after ten minutes and burns provider failures without account effects', async () => {
  let now = 1000
  let calls = 0
  const flow = createGoogleFlow({ store, now: () => now, authorize: async () => 'https://accounts.google.com/authorize', exchange: async () => { throw new Error('provider rejected') }, finish: async () => { calls++; return 'never' } })
  const expired = await flow.start({ browser: 'browser' })
  now = 601000
  await expect(flow.callback(expired.state, 'browser', 'https://app.test/callback')).rejects.toThrow('AUTH_FAILED')
  const failed = await flow.start({ browser: 'browser' })
  await expect(flow.callback(failed.state, 'browser', 'https://app.test/callback')).rejects.toThrow('provider rejected')
  await expect(flow.callback(failed.state, 'browser', 'https://app.test/callback')).rejects.toThrow('AUTH_FAILED')
  expect(calls).toBe(0)
})
import { authorizeGoogleAccount } from '../src/auth/application/googleAccountPolicy'
it('a matching verified Google email never authorizes a local account without explicit linking', () => {
  expect(() => authorizeGoogleAccount({ purpose: 'login', signup: true, linked: null, emailAccountExists: true, identity: { sub: 'subject', email: 'local@example.com', emailVerified: true } })).toThrow('AUTH_FAILED')
})
