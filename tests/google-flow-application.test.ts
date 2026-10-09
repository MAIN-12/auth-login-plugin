import { expect, it, vi } from 'vitest'
import { createGoogleFlow } from '../src/auth/application/use-cases/googleFlow'

function dependencies(enabled = true) {
  return {
    enabled,
    now: () => 1000,
    crypto: { random: () => 'a'.repeat(43) },
    correlations: { save: vi.fn(), consume: vi.fn() },
    provider: { authorize: vi.fn(), exchange: vi.fn() },
    authorizeStart: vi.fn(),
    readPermit: vi.fn(),
    finish: vi.fn(),
  }
}
it('disabled internal start and callback deny before any provider, correlation or account effect', async () => {
  const ports = dependencies(false)
  const flow = createGoogleFlow(ports)
  await expect(flow.start({ browser: 'browser' })).rejects.toThrow('METHOD_DISABLED')
  await expect(
    flow.callback({ state: 'a'.repeat(43), browser: 'browser', url: 'https://app.test/callback' }),
  ).rejects.toThrow('METHOD_DISABLED')
  for (const effect of [
    ports.correlations.save,
    ports.correlations.consume,
    ports.provider.authorize,
    ports.provider.exchange,
    ports.authorizeStart,
    ports.finish,
  ])
    expect(effect).not.toHaveBeenCalled()
})
it('a missing explicit link permission denies before reading a principal or contacting Google', async () => {
  const ports = dependencies()
  await expect(
    createGoogleFlow(ports).start({ browser: 'browser', purpose: 'link' }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(ports.authorizeStart).not.toHaveBeenCalled()
  expect(ports.provider.authorize).not.toHaveBeenCalled()
})
it('callback commits burn before exchange and never finishes a malformed stable identity', async () => {
  const ports = dependencies()
  const order: string[] = []
  ports.correlations.consume.mockImplementation(async () => {
    order.push('consume')
    return {
      state: 'a'.repeat(43),
      browser: 'browser',
      nonce: 'nonce',
      verifier: 'verifier',
      returnTo: '/',
      expiresAt: 601000,
      purpose: 'login',
    }
  })
  ports.provider.exchange.mockImplementation(async () => {
    order.push('exchange')
    return { sub: '', emailVerified: true }
  })
  await expect(
    createGoogleFlow(ports).callback({
      state: 'a'.repeat(43),
      browser: 'browser',
      url: 'https://app.test/callback',
    }),
  ).rejects.toThrow('AUTH_FAILED')
  expect(order).toEqual(['consume', 'exchange'])
  expect(ports.finish).not.toHaveBeenCalled()
})
import { createGoogleCorrelationCrypto } from '../src/auth/infrastructure/crypto/googleCorrelationCrypto'
import { createGoogleCorrelations } from '../src/auth/infrastructure/payload/googleCorrelations'
import type { OtpStore } from '../src/auth/infrastructure/payload/otpLedger'
function durableFixture() {
  const records = new Map<string, Record<string, unknown>>()
  const store: OtpStore = {
    transaction: async (_keys, work) =>
      work({
        get: async (key) => records.get(key),
        put: async (key, value) => {
          records.set(key, value)
        },
      }),
  }
  const crypto = createGoogleCorrelationCrypto('customers:epoch')
  const ports = {
    ...dependencies(),
    crypto,
    correlations: createGoogleCorrelations(store, crypto.key),
  }
  ports.provider.authorize.mockResolvedValue('https://accounts.google.com/authorize')
  ports.provider.exchange.mockResolvedValue({ sub: 'stable', emailVerified: true })
  ports.finish.mockResolvedValue({ success: true })
  return { ports, records, store }
}
it.each(['provider', 'commit'] as const)(
  'irreversible callback burn survives asynchronous %s failure and denies replay',
  async (phase) => {
    const { ports } = durableFixture()
    const effect = phase === 'provider' ? ports.provider.exchange : ports.finish
    effect.mockImplementationOnce(async () => {
      await Promise.resolve()
      throw new Error('private failure')
    })
    const flow = createGoogleFlow(ports)
    const start = await flow.start({ browser: 'one', returnTo: 'https://attacker.test' })
    await expect(
      flow.callback({ state: start.state, browser: 'wrong', url: 'https://app.test/callback' }),
    ).rejects.toThrow('AUTH_FAILED')
    expect(ports.provider.exchange).not.toHaveBeenCalled()
    await expect(
      flow.callback({ state: start.state, browser: 'one', url: 'https://app.test/callback' }),
    ).rejects.toThrow('private failure')
    await expect(
      flow.callback({ state: start.state, browser: 'one', url: 'https://app.test/callback' }),
    ).rejects.toThrow('AUTH_FAILED')
    expect(ports.provider.exchange).toHaveBeenCalledTimes(1)
    expect(ports.finish).toHaveBeenCalledTimes(phase === 'provider' ? 0 : 1)
  },
)
it('callback consumes before exchange and finish, preserves TTL/local continuation and isolates collection/epoch', async () => {
  const { ports, store, records } = durableFixture()
  const order: string[] = []
  const consume = ports.correlations.consume
  ports.correlations.consume = async (...args) => {
    const result = await consume(...args)
    order.push('consume')
    return result
  }
  ports.provider.exchange.mockImplementation(async () => {
    order.push('exchange')
    return { sub: 'stable', emailVerified: true }
  })
  ports.finish.mockImplementation(async () => {
    order.push('finish')
    return { success: true }
  })
  const flow = createGoogleFlow(ports)
  const start = await flow.start({ browser: 'one', returnTo: '/profile?q=1#methods' })
  expect([...records.values()][0].expiresAt).toBe(601000)
  const otherCrypto = createGoogleCorrelationCrypto('members:epoch')
  await expect(
    createGoogleCorrelations(store, otherCrypto.key).consume(start.state, 'one', 1000),
  ).rejects.toThrow('AUTH_FAILED')
  expect(
    await flow.callback({ state: start.state, browser: 'one', url: 'https://app.test/callback' }),
  ).toEqual({ result: { success: true }, purpose: 'login', returnTo: '/profile?q=1#methods' })
  expect(order).toEqual(['consume', 'exchange', 'finish'])
})
it('durable correlation storage failure cannot fall back or exchange identity', async () => {
  const { ports } = durableFixture()
  ports.correlations.consume = async () => {
    throw new Error('storage unavailable')
  }
  await expect(
    createGoogleFlow(ports).callback({
      state: 'a'.repeat(43),
      browser: 'one',
      url: 'https://app.test/callback',
    }),
  ).rejects.toThrow('storage unavailable')
  expect(ports.provider.exchange).not.toHaveBeenCalled()
  expect(ports.finish).not.toHaveBeenCalled()
})
