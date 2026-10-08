import { expect, it } from 'vitest'
import { createOtpLogin } from '../src/auth/application/use-cases/otpLogin'

it('disabled direct OTP calls deny before consulting evidence, generation or storage', async () => {
  const touched: string[] = []
  const flow = createOtpLogin({
    enabled: false,
    flow: async () => {
      touched.push('composition')
      throw new Error('secret')
    },
  })
  await expect(flow.send({ email: 'user@example.com', purpose: 'login' }, 'peer')).resolves.toEqual(
    { ok: false, code: 'METHOD_DISABLED' },
  )
  await expect(
    flow.verify({
      email: 'user@example.com',
      purpose: 'login',
      context: 'a'.repeat(64),
      otp: '123456',
    }),
  ).resolves.toEqual({ ok: false, code: 'METHOD_DISABLED' })
  expect(touched).toEqual([])
})

import { createOtpProtocol } from '../src/auth/application/use-cases/otpProtocol'
import { createOtpCodec } from '../src/auth/infrastructure/crypto/otpCodec'
import { createOtpLedger } from '../src/auth/infrastructure/payload/otpLedger'

function fixture() {
  let now = 1_000_000
  let identity: string | null = 'account-A/version-A'
  let unavailable = false
  let mailFails = false
  let sessionFails = false
  const rows = new Map<string, Record<string, unknown>>()
  const effects: string[] = []
  let tail: Promise<unknown> = Promise.resolve()
  const ledger = createOtpLedger({
    transaction: (keys, work) => {
      const result = tail.then(async () => {
        if (unavailable) throw new Error('secret storage failure')
        const staged = new Map(rows)
        const value = await work({
          get: async (key) => staged.get(key),
          put: async (key, record) => {
            staged.set(key, record)
          },
        })
        rows.clear()
        for (const [key, record] of staged) rows.set(key, record)
        effects.push(keys.length === 1 ? 'burn-committed' : 'reserved')
        return value
      })
      tail = result.catch(() => {})
      return result
    },
  })
  const protocol = createOtpProtocol({
    collection: 'customers',
    codec: createOtpCodec('s'.repeat(32)),
    ledger,
    now: () => now,
    random: () => '123456',
    context: () => 'a'.repeat(64),
    findAccount: async () => identity,
    deliver: async () => {
      effects.push('mail')
      if (mailFails) throw new Error('smtp secret')
    },
    session: async (accountID) => {
      effects.push('session')
      if (sessionFails) throw new Error('hook secret')
      return { accountID, collection: 'customers' }
    },
    event: () => {},
  })
  const flow = createOtpLogin({ enabled: true, flow: async () => protocol })
  const send = (context?: string) =>
    flow.send(
      { email: 'user@example.com', purpose: 'login', ...(context ? { context } : {}) },
      'trusted-peer',
    )
  const verify = (otp = '123456', context = 'a'.repeat(64)) =>
    flow.verify({ email: 'user@example.com', purpose: 'login', context, otp })
  return {
    send,
    verify,
    flow,
    effects,
    rows,
    tick: (ms: number) => {
      now += ms
    },
    replace: (id: string | null) => {
      identity = id
    },
    failStorage: () => {
      unavailable = true
    },
    failMail: () => {
      mailFails = true
    },
    failSession: () => {
      sessionFails = true
    },
  }
}
it('an omitted consumed flag in a durable challenge never grants authority', async () => {
  const f = fixture()
  await f.send()
  for (const record of f.rows.values()) if ('ciphertext' in record) delete record.consumed
  expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(f.effects).not.toContain('session')
})
it('interleaved direct verifications grant a single native session after committed burn', async () => {
  const f = fixture()
  await f.send()
  const results = await Promise.all([f.verify(), f.verify()])
  expect(results.filter((result) => result.ok)).toHaveLength(1)
  expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: 'AUTH_FAILED' }])
  expect(f.effects.filter((effect) => effect === 'session')).toHaveLength(1)
  expect(f.effects.indexOf('burn-committed')).toBeLessThan(f.effects.indexOf('session'))
  expect(JSON.stringify(results)).not.toMatch(/123456|token|secret|ciphertext/)
})
it('session rejection burns proof permanently and hides hook failure', async () => {
  const f = fixture()
  await f.send()
  f.failSession()
  expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(f.effects.filter((effect) => effect === 'session')).toHaveLength(1)
})
it('accepted mail failure keeps cooldown and attempt budgets through resend', async () => {
  const f = fixture()
  f.failMail()
  const sent = await f.send()
  expect(sent).toEqual({
    ok: true,
    value: { success: true, code: 'OTP_REQUEST_ACCEPTED', context: 'a'.repeat(64), retryAfter: 60 },
  })
  expect(await f.send('a'.repeat(64))).toEqual(sent)
  expect(f.effects.filter((effect) => effect === 'mail')).toHaveLength(1)
  for (let attempt = 0; attempt < 3; attempt++)
    expect(await f.verify('000000')).toEqual({ ok: false, code: 'AUTH_FAILED' })
  f.tick(60_000)
  expect(await f.send('a'.repeat(64))).toEqual(sent)
  expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(f.effects).not.toContain('session')
})
it('storage failure closes without delivery or session fallback', async () => {
  const f = fixture()
  f.failStorage()
  expect(await f.send()).toEqual({ ok: false, code: 'AUTH_UNAVAILABLE' })
  expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_UNAVAILABLE' })
  expect(f.effects).toEqual([])
})
it.each(['account-B/version-A', 'account-A/version-B', null])(
  'replacement evidence %s cannot claim an old proof',
  async (identity) => {
    const f = fixture()
    await f.send()
    f.replace(identity)
    expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_FAILED' })
    expect(f.effects).not.toContain('session')
  },
)
it('expired/context/purpose/invalid input are denied without granting a session', async () => {
  const f = fixture()
  await f.send()
  expect(await f.verify('123456', 'b'.repeat(64))).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(
    await f.flow.verify({
      email: 'user@example.com',
      purpose: 'recovery' as 'login',
      context: 'a'.repeat(64),
      otp: '123456',
    }),
  ).toEqual({ ok: false, code: 'INVALID_INPUT' })
  const g = fixture()
  expect(
    await g.flow.send(
      { email: 'user@example.com', purpose: 'login', injected: true } as {
        email: string
        purpose: 'login'
      },
      'peer',
    ),
  ).toEqual({ ok: false, code: 'INVALID_INPUT' })
  expect(g.effects).toEqual([])
  f.tick(300_000)
  expect(await f.verify()).toEqual({ ok: false, code: 'AUTH_FAILED' })
  expect(f.effects).not.toContain('session')
})
