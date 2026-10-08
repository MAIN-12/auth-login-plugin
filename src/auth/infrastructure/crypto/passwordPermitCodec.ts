import { createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { AuthOperationFailure } from '../../domain/errors'
import type { PasswordPermit } from '../../application/ports/ownership'
/** Historical v1 encryption, AAD, namespace and TTL; decoding is not commit authority. */
export function createPasswordPermitCodec(dependencies: {
  secret: string
  collection: string
  now?: () => number
}) {
  const now = dependencies.now ?? Date.now
  const key = createHmac('sha256', dependencies.secret)
    .update('auth-login/permit-encryption/v1')
    .digest()
  const aad = Buffer.from(`auth-login/permit/v1:${dependencies.collection}`)
  const grant = (permit: PasswordPermit) => {
    const expiresAt = now() + (permit.purpose === 'reauth' ? 300_000 : 600_000)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(aad)
    const encrypted = Buffer.concat([
      cipher.update(
        JSON.stringify({ ...permit, expiresAt, nonce: randomBytes(32).toString('hex') }),
      ),
      cipher.final(),
    ])
    return {
      success: true as const,
      permit: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'),
      expiresAt,
    }
  }
  function readPermit(
    purpose: PasswordPermit['purpose'],
    encoded: string,
  ): PasswordPermit & { expiresAt: number } {
    let permit: PasswordPermit & { expiresAt: number }
    try {
      const bytes = Buffer.from(encoded, 'base64url')
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
      cipher.setAAD(aad)
      cipher.setAuthTag(bytes.subarray(12, 28))
      permit = JSON.parse(
        Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'),
      )
    } catch {
      throw new AuthOperationFailure('AUTH_FAILED')
    }
    if (
      permit.purpose !== purpose ||
      !Number.isFinite(permit.expiresAt) ||
      permit.expiresAt <= now() ||
      typeof permit.email !== 'string' ||
      typeof permit.version !== 'string' ||
      typeof permit.nonce !== 'string' ||
      !/^[a-f0-9]{64}$/.test(permit.nonce)
    )
      throw new AuthOperationFailure('AUTH_FAILED')
    return permit
  }
  return { grant, read: readPermit }
}
