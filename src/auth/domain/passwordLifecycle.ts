import { createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { AuthFailure } from './login'
import { isPasswordValid } from './passwordRules'

export interface PasswordPermit {
  purpose: 'signup' | 'recovery' | 'reauth'
  email: string
  account: string | number | null
  version: string
  nonce?: string
  expiresAt?: number
  sid?: string
}
/** Application policy; the native adapter owns the single commit boundary and stale-proof check. */
export function createPasswordLifecycle<T>(dependencies: {
  secret: string; collection: string; signup: boolean; recovery: boolean; password: boolean
  now?: () => number
  commit: (permit: PasswordPermit, password: string) => Promise<T>
}) {
  const now = dependencies.now ?? Date.now
  const key = createHmac('sha256', dependencies.secret).update('auth-login/permit-encryption/v1').digest()
  const aad = Buffer.from(`auth-login/permit/v1:${dependencies.collection}`)
  const enabled = (purpose: PasswordPermit['purpose']) => dependencies.password && (purpose === 'signup' ? dependencies.signup : purpose === 'recovery' ? dependencies.recovery : true)
  const grant = (permit: PasswordPermit) => {
    if (!enabled(permit.purpose)) throw new AuthFailure('METHOD_DISABLED', 403)
    const expiresAt = now() + (permit.purpose === 'reauth' ? 300_000 : 600_000)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(aad)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ ...permit, expiresAt, nonce: randomBytes(32).toString('hex') })), cipher.final()])
    return { success: true as const, permit: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'), expiresAt }
  }
  async function complete(purpose: PasswordPermit['purpose'], input: unknown): Promise<T> {
    if (!enabled(purpose)) throw new AuthFailure('METHOD_DISABLED', 403)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthFailure('INVALID_INPUT', 400)
    const data = input as Record<string, unknown>
    if (Object.keys(data).some(key => !['permit', 'password'].includes(key)) || typeof data.permit !== 'string' || data.permit.length > 2048 || typeof data.password !== 'string' || !isPasswordValid(data.password)) throw new AuthFailure('INVALID_INPUT', 400)
    let permit: PasswordPermit & { expiresAt: number }
    try {
      const bytes = Buffer.from(data.permit, 'base64url')
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
      cipher.setAAD(aad)
      cipher.setAuthTag(bytes.subarray(12, 28))
      permit = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'))
    } catch { throw new AuthFailure('AUTH_FAILED', 401) }
    if (permit.purpose !== purpose || !Number.isFinite(permit.expiresAt) || permit.expiresAt <= now() || typeof permit.email !== 'string' || typeof permit.version !== 'string' || typeof permit.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(permit.nonce)) throw new AuthFailure('AUTH_FAILED', 401)
    return dependencies.commit(permit, data.password)
  }
  return { grant, complete }
}
