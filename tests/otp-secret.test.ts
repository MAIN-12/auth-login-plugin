import { createHmac, hkdfSync } from 'node:crypto'
import { expect, it } from 'vitest'
import { createOtpCodec, resolveOtpSecret } from '../src/auth/infrastructure/crypto/otpCodec'
import { resolveAuthConfig, type AuthLoginPluginOptions } from '../src/config'

const root = 'root-payload-secret-with-high-entropy-32-characters'
const options: AuthLoginPluginOptions = {
  passwordLogin: true,
  otpLogin: true,
  allowSignup: true,
  recovery: true,
  providers: { google: false },
  otp: { origin: () => 'trusted-peer', email: { from: 'auth@example.com', locale: 'en' } },
}
it('derives a stable versioned, domain-separated OTP key from each Payload root', () => {
  const key = resolveOtpSecret(undefined, root)
  expect(key).toMatch(/^[a-f0-9]{64}$/)
  expect(key).toBe('f41fc977b3327850321618514cc0a06a0df9552ea2d34e7a59067e5ffef214ed')
  expect(key).toBe(
    Buffer.from(
      hkdfSync('sha256', root, 'auth-login/otp/hkdf-salt/v1', 'auth-login/otp/v1', 32),
    ).toString('hex'),
  )
  expect(resolveOtpSecret(undefined, root)).toBe(key)
  expect(resolveOtpSecret(undefined, root + '-other')).not.toBe(key)
  expect(key).not.toBe(
    Buffer.from(
      hkdfSync('sha256', root, 'auth-login/otp/hkdf-salt/v1', 'auth-login/password/v1', 32),
    ).toString('hex'),
  )
  expect(createOtpCodec(key).keyed('challenge')).not.toBe(createOtpCodec(root).keyed('challenge'))
  const ciphertext = createOtpCodec(key).seal('123456', 'binding')
  expect(createOtpCodec(resolveOtpSecret(undefined, root)).open(ciphertext, 'binding')).toBe(
    '123456',
  )
  expect(() =>
    createOtpCodec(resolveOtpSecret(undefined, root + '-other')).open(ciphertext, 'binding'),
  ).toThrow()
})
it('preserves the explicit legacy key and HMAC byte-for-byte without validating an unused root', () => {
  expect(resolveOtpSecret(root, '')).toBe(root)
  const codec = createOtpCodec(resolveOtpSecret(root, 'unused'))
  expect(codec.keyed('otp-encryption-v1')).toBe(
    createHmac('sha256', root).update('otp-encryption-v1').digest('hex'),
  )
  const legacy = createOtpCodec(root).seal('654321', 'legacy-binding')
  expect(codec.open(legacy, 'legacy-binding')).toBe('654321')
})
it.each([null, '', 'short', 32, {}, []])(
  'rejects malformed override %j instead of falling back',
  (secret) => {
    expect(() => resolveOtpSecret(secret as string, root)).toThrow('OTP secret')
    expect(() =>
      resolveAuthConfig({ ...options, otp: { ...options.otp!, secret: secret as string } }),
    ).toThrow('OTP requires')
  },
)
it.each([undefined, null, '', 'short', 32, {}, []])(
  'rejects malformed Payload root %j only for the default',
  (secret) => {
    expect(() => resolveOtpSecret(undefined, secret as string)).toThrow('Payload secret')
    expect(resolveOtpSecret(root, secret as string)).toBe(root)
  },
)
it('allows all OTP methods without an override and excludes key material from public config', () => {
  expect(resolveAuthConfig(options)).toMatchObject({
    otpLogin: true,
    allowSignup: true,
    recovery: true,
  })
  expect(JSON.stringify(resolveAuthConfig(options))).not.toMatch(/secret|origin/)
})
