import { AuthOperationFailure } from '../../domain/errors'
import { parseOtpInput } from '../../domain/otpRules'
import type { OtpProtocolDependencies } from '../ports/otp'

/** Rules are transport-independent; only durable adapter transactions own concurrency. */
export function createOtpProtocol<T>(dependencies: OtpProtocolDependencies<T>) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(dependencies.collection))
    throw new Error('auth-login: invalid OTP collection')
  const purpose = dependencies.purpose ?? 'login'
  const now = dependencies.now
  const cooldown = dependencies.cooldownSeconds ?? 60
  const ttl = dependencies.ttlSeconds ?? 300
  const attempts = dependencies.maxAttempts ?? 3
  const accountLimit = dependencies.accountLimit ?? 5
  const originLimit = dependencies.originLimit ?? 50
  for (const value of [cooldown, ttl, attempts, accountLimit, originLimit])
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('auth-login: invalid OTP limit')
  const { keyed, seal, open } = dependencies.codec
  const accountKeyFor = (email: string) =>
    keyed(
      JSON.stringify([
        'account',
        dependencies.collection,
        purpose,
        email,
        ...(dependencies.challengeGeneration ? [dependencies.challengeGeneration] : []),
      ]),
    )
  const bindingFor = (key: string, context: string, account: unknown) =>
    JSON.stringify([dependencies.collection, key, context, purpose, account])
  const event = (kind: Parameters<OtpProtocolDependencies<T>['event']>[0], correlation: string) => {
    try {
      dependencies.event(kind, correlation)
    } catch {
      /* Logging never overrides authentication policy. */
    }
  }
  async function send(input: unknown, origin: string | null) {
    const data = parseOtpInput(input, false, purpose)
    if (!origin || origin.length > 512) {
      event('unavailable', accountKeyFor(data.email))
      throw new AuthOperationFailure('AUTH_UNAVAILABLE')
    }
    const context = data.context ?? dependencies.context?.() ?? dependencies.codec.context()
    const accountKey = accountKeyFor(data.email)
    const originKey = keyed(`origin:${origin}`)
    let delivery: { email: string; code: string } | undefined
    try {
      const accountID = await dependencies.findAccount(data.email)
      const quotaKey = keyed(
        JSON.stringify([
          'quota',
          dependencies.collection,
          accountID === null
            ? ['email', data.email]
            : ['id', dependencies.quotaIdentity?.(accountID) ?? accountID],
        ]),
      )
      await dependencies.ledger.reserve([accountKey, originKey, quotaKey], async (state) => {
        const timestamp = now()
        const originState = (await state.readBudget(originKey)) ?? {}
        const originTimes = ((originState.times ?? []) as number[]).filter(
          (time) => time > timestamp - 3_600_000,
        )
        // Every request counts, including cooldown hits and unknown accounts.
        originTimes.push(timestamp)
        await state.writeBudget(originKey, { times: originTimes.slice(-originLimit - 1) })
        const account = (await state.readChallenge(accountKey)) ?? {}
        const quota = (await state.readBudget(quotaKey)) ?? {}
        const times = ((quota.times ?? []) as number[]).filter(
          (time) => time > timestamp - 3_600_000,
        )
        if (
          originTimes.length > originLimit ||
          times.length >= accountLimit ||
          (typeof quota.sentAt === 'number' && timestamp - quota.sentAt < cooldown * 1000)
        ) {
          event('limited', accountKey)
          return
        }
        const active =
          typeof account.expiresAt === 'number' &&
          account.expiresAt > timestamp &&
          account.consumed !== true
        // New browsers cannot replace a live challenge; resend preserves its binding and budgets.
        if (active && account.context !== context) {
          event('limited', accountKey)
          return
        }
        times.push(timestamp)
        let record = account
        if (!active) {
          const code = dependencies.random?.() ?? dependencies.codec.random()
          if (!/^\d{6}$/.test(code)) throw new Error('Invalid random adapter')
          const binding = bindingFor(accountKey, context, accountID)
          record = {
            accountID,
            context,
            expiresAt: timestamp + ttl * 1000,
            attempts: 0,
            consumed: false,
            ciphertext: seal(code, binding),
            verifier: keyed(`${binding}:${code}`),
          }
        }
        await state.writeBudget(quotaKey, { times, sentAt: timestamp })
        await state.writeChallenge(accountKey, record)
        if (accountID !== null && record.accountID === accountID)
          delivery = {
            email: data.email,
            code: open(
              record.ciphertext as string,
              bindingFor(accountKey, context, record.accountID),
            ),
          }
      })
    } catch {
      event('unavailable', accountKey)
      throw new AuthOperationFailure('AUTH_UNAVAILABLE')
    }
    if (delivery) {
      // Reservation is committed before mail. No automatic retry: next cooldown-bound resend reuses code.
      try {
        await dependencies.deliver(delivery)
        event('send', accountKey)
      } catch {
        event('mail_failed', accountKey)
      }
    }
    // Accepted is deliberately NOT a delivery assertion; identical for absent/limited/mail-failed accounts.
    return {
      success: true as const,
      code: 'OTP_REQUEST_ACCEPTED' as const,
      context,
      retryAfter: cooldown,
    }
  }
  async function verify(input: unknown): Promise<T> {
    const data = parseOtpInput(input, true, purpose)
    const key = accountKeyFor(data.email)
    let granted: string | number | null = null
    try {
      granted = await dependencies.ledger.consume(key, async (state) => {
        const record = await state.readChallenge(key)
        if (
          !record ||
          record.consumed !== false ||
          typeof record.expiresAt !== 'number' ||
          !Number.isFinite(record.expiresAt) ||
          record.expiresAt <= now() ||
          typeof record.attempts !== 'number' ||
          !Number.isSafeInteger(record.attempts) ||
          record.attempts < 0 ||
          record.attempts >= attempts ||
          record.context !== data.context ||
          (typeof record.accountID !== 'string' && typeof record.accountID !== 'number')
        )
          return null
        if ((await dependencies.findAccount(data.email)) !== record.accountID) return null
        const actual = keyed(`${bindingFor(key, data.context!, record.accountID)}:${data.otp}`)
        const matches = dependencies.codec.matches(actual, String(record.verifier))
        await state.writeChallenge(key, {
          ...record,
          attempts: Number(record.attempts) + 1,
          consumed: matches,
        })
        return matches ? (record.accountID as string | number) : null
      })
    } catch {
      event('unavailable', key)
      throw new AuthOperationFailure('AUTH_UNAVAILABLE')
    }
    if (granted === null) {
      event('verify_failed', key)
      throw new AuthOperationFailure('AUTH_FAILED')
    }
    // Consumption commits first: session/hook/mail crashes burn the challenge, never authorize twice.
    try {
      const account = await dependencies.findAccount(data.email)
      if (account !== granted) throw new AuthOperationFailure('AUTH_FAILED')
      return await dependencies.session(granted, data.email)
    } catch {
      event('verify_failed', key)
      throw new AuthOperationFailure('AUTH_FAILED')
    }
  }
  return { send, verify }
}
