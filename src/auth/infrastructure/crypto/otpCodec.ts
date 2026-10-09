import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto'
import type { OtpCodec } from '../../application/ports/otp'

export function createOtpCodec(secret: string): OtpCodec {
  if (secret.length < 32)
    throw new Error('auth-login: OTP secret must contain at least 32 characters')
  const keyed = (value: string) => createHmac('sha256', secret).update(value).digest('hex')
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
  return {
    keyed,
    seal,
    open,
    matches: (actual, expected) => {
      const a = Buffer.from(actual, 'hex')
      const b = Buffer.from(expected, 'hex')
      return a.length === b.length && timingSafeEqual(a, b)
    },
    random: () => randomInt(0, 1_000_000).toString().padStart(6, '0'),
    context: () => randomBytes(32).toString('hex'),
  }
}
