import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto'
import { AuthFailure } from './login'

export interface OtpStateAccess {
  get(key: string): Promise<Record<string, unknown> | undefined>
  put(key: string, value: Record<string, unknown>): Promise<void>
}
export interface OtpStore {
  transaction<T>(keys: string[], work: (state: OtpStateAccess) => Promise<T>): Promise<T>
}
export interface OtpDependencies<T> {
  purpose?: 'login' | 'signup' | 'recovery' | 'reauth' | 'verify-email'
  secret: string
  collection: string
  challengeGeneration?: string
  store: OtpStore
  now?: () => number
  random?: () => string
  context?: () => string
  quotaIdentity?: (account: string | number) => string | number
  findAccount: (email: string) => Promise<string | number | null>
  deliver: (mail: { email: string; code: string }) => Promise<void>
  session: (account: string | number, email: string) => Promise<T>
  event: (
    event: 'limited' | 'mail_failed' | 'send' | 'verify_failed' | 'unavailable',
    correlation: string,
  ) => void
  ttlSeconds?: number
  cooldownSeconds?: number
  maxAttempts?: number
  accountLimit?: number
  originLimit?: number
}
interface Input {
  email: string
  purpose: 'login' | 'signup' | 'recovery' | 'reauth' | 'verify-email'
  context?: string
  otp?: string
}
function parse(input: unknown, verify: boolean, purpose: string): Input {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthFailure('INVALID_INPUT', 400)
  const data = input as Record<string, unknown>
  if (
    Object.keys(data).some(
      (key) => !['email', 'purpose', 'context', ...(verify ? ['otp'] : [])].includes(key),
    ) ||
    typeof data.email !== 'string' ||
    data.email.length > 254 ||
    data.purpose !== purpose
  )
    throw new AuthFailure('INVALID_INPUT', 400)
  const email = data.email.trim().toLowerCase()
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (data.context !== undefined &&
      (typeof data.context !== 'string' || !/^[a-f0-9]{64}$/.test(data.context))) ||
    (verify && (typeof data.otp !== 'string' || !/^\d{6}$/.test(data.otp) || !data.context))
  )
    throw new AuthFailure('INVALID_INPUT', 400)
  return {
    email,
    purpose: purpose as Input['purpose'],
    context: data.context as string | undefined,
    otp: data.otp as string | undefined,
  }
}
/** Rules are transport-independent; only durable adapter transactions own concurrency. */
export function createOtpFlow<T>(dependencies: OtpDependencies<T>) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(dependencies.collection))
    throw new Error('auth-login: invalid OTP collection')
  if (dependencies.secret.length < 32)
    throw new Error('auth-login: OTP secret must contain at least 32 characters')
  const purpose = dependencies.purpose ?? 'login'
  const now = dependencies.now ?? Date.now
  const cooldown = dependencies.cooldownSeconds ?? 60
  const ttl = dependencies.ttlSeconds ?? 300
  const attempts = dependencies.maxAttempts ?? 3
  const accountLimit = dependencies.accountLimit ?? 5
  const originLimit = dependencies.originLimit ?? 50
  for (const value of [cooldown, ttl, attempts, accountLimit, originLimit])
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('auth-login: invalid OTP limit')
  const keyed = (value: string) =>
    createHmac('sha256', dependencies.secret).update(value).digest('hex')
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
  const cipherKey = Buffer.from(keyed('otp-encryption-v1'), 'hex')
  const seal = (code: string, binding: string) => {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', cipherKey, iv)
    cipher.setAAD(Buffer.from(binding))
    const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
  }
  const open = (ciphertext: string, binding: string) => {
    const bytes = Buffer.from(ciphertext, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', cipherKey, bytes.subarray(0, 12))
    decipher.setAAD(Buffer.from(binding))
    decipher.setAuthTag(bytes.subarray(12, 28))
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
  }
  const event = (kind: Parameters<OtpDependencies<T>['event']>[0], correlation: string) => {
    try {
      dependencies.event(kind, correlation)
    } catch {
      /* Logging never overrides authentication policy. */
    }
  }
  async function send(input: unknown, origin: string | null) {
    const data = parse(input, false, purpose)
    if (!origin || origin.length > 512) {
      event('unavailable', accountKeyFor(data.email))
      throw new AuthFailure('AUTH_UNAVAILABLE', 503)
    }
    const context = data.context ?? dependencies.context?.() ?? randomBytes(32).toString('hex')
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
      await dependencies.store.transaction([accountKey, originKey, quotaKey], async (state) => {
        const timestamp = now()
        const originState = (await state.get(originKey)) ?? {}
        const originTimes = ((originState.times ?? []) as number[]).filter(
          (time) => time > timestamp - 3_600_000,
        )
        // Every request counts, including cooldown hits and unknown accounts.
        originTimes.push(timestamp)
        await state.put(originKey, { times: originTimes.slice(-originLimit - 1) })
        const account = (await state.get(accountKey)) ?? {}
        const quota = (await state.get(quotaKey)) ?? {}
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
          const code =
            dependencies.random?.() ?? randomInt(0, 1_000_000).toString().padStart(6, '0')
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
        await state.put(quotaKey, { times, sentAt: timestamp })
        await state.put(accountKey, record)
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
      throw new AuthFailure('AUTH_UNAVAILABLE', 503)
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
    const data = parse(input, true, purpose)
    const key = accountKeyFor(data.email)
    let granted: string | number | null = null
    try {
      granted = await dependencies.store.transaction([key], async (state) => {
        const record = await state.get(key)
        if (
          !record ||
          record.consumed === true ||
          Number(record.expiresAt) <= now() ||
          Number(record.attempts) >= attempts ||
          record.context !== data.context ||
          (typeof record.accountID !== 'string' && typeof record.accountID !== 'number')
        )
          return null
        if ((await dependencies.findAccount(data.email)) !== record.accountID) return null
        const actual = Buffer.from(
          keyed(`${bindingFor(key, data.context!, record.accountID)}:${data.otp}`),
          'hex',
        )
        const expected = Buffer.from(String(record.verifier), 'hex')
        const matches = expected.length === actual.length && timingSafeEqual(actual, expected)
        await state.put(key, {
          ...record,
          attempts: Number(record.attempts) + 1,
          consumed: matches,
        })
        return matches ? (record.accountID as string | number) : null
      })
    } catch {
      event('unavailable', key)
      throw new AuthFailure('AUTH_UNAVAILABLE', 503)
    }
    if (granted === null) {
      event('verify_failed', key)
      throw new AuthFailure('AUTH_FAILED', 401)
    }
    // Consumption commits first: session/hook/mail crashes burn the challenge, never authorize twice.
    try {
      const account = await dependencies.findAccount(data.email)
      if (account !== granted) throw new AuthFailure('AUTH_FAILED', 401)
      return await dependencies.session(granted, data.email)
    } catch {
      event('verify_failed', key)
      throw new AuthFailure('AUTH_FAILED', 401)
    }
  }
  return { send, verify }
}
