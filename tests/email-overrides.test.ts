import { expect, it } from 'vitest'
import { buildConfig, getPayload, handleEndpoints } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin, type AuthEmailOverrides } from '../src/index'
import { renderAuthEmail } from '../src/shared/infrastructure/email/renderAuthEmail'
import { generateWelcomeEmail } from '../src/shared/infrastructure/email/templates/welcome'

it('uses async custom templates and built-in fallbacks without leaking delivery fields', async () => {
  const params = { userName: '<Guest>', loginUrl: 'https://example.com/login' }
  expect(await renderAuthEmail('welcome', params)).toEqual(generateWelcomeEmail(params))
  for (const type of ['otp', 'welcome', 'passwordReset', 'passwordChanged'] as const) {
    const result = await renderAuthEmail(
      type,
      { ...params, otp: '123456' },
      {
        [type]: async () => ({
          subject: 'Custom subject',
          html: '<p>Custom design</p>',
          to: 'other@example.com',
        }),
      },
    )
    expect(result).toEqual({
      subject:
        type === 'otp' || type === 'passwordReset' ? '123456: Custom subject' : 'Custom subject',
      html: '<p>Custom design</p>',
    })
  }
  await expect(
    renderAuthEmail('welcome', params, {
      welcome: () => ({ subject: 'Bad\r\nBcc: someone', html: '<p>Hi</p>' }),
    }),
  ).rejects.toThrow('email renderer')
})

it('delivers captured custom OTP templates for login, signup, recovery and verification through Payload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'email-overrides-'))
  const seen: Array<{ purpose?: string; language?: string; expiresInSeconds?: number }> = []
  const delivered: Array<{ to: unknown; html: unknown }> = []
  let now = Date.now()
  const emails: AuthEmailOverrides = {
    otp: async (params) => {
      seen.push(params)
      expect(params.baseOptions?.projectName).toBe('My project')
      expect(params.baseOptions?.colors?.primary).toBe('#123456')
      expect(params.baseOptions?.contactEmail).toBe('help@example.com')
      return { subject: 'Your custom code', html: `<p>${params.otp}</p>` }
    },
  }
  const plugin = authLoginPlugin({
    passwordLogin: true,
    otpLogin: true,
    allowSignup: true,
    recovery: true,
    providers: { google: false },
    projectName: 'My project',
    emails,
    emailAccentColor: '#123456',
    contactEmail: 'help@example.com',
    otp: {
      origin: () => 'test-peer',
      now: () => now,
      cooldownSeconds: 1,
      ttlSeconds: 120,
      email: { from: 'auth@example.com', locale: 'en' },
    },
  })
  emails.otp = () => {
    throw new Error('caller mutation must not replace captured callback')
  }
  expect(JSON.stringify(plugin.publicConfig)).not.toContain('emails')
  expect(JSON.stringify(plugin.publicConfig)).not.toContain('help@example.com')
  const config = await buildConfig({
    secret: 'email-test-secret-with-at-least-32-characters',
    telemetry: false,
    typescript: { autoGenerate: false },
    db: sqliteAdapter({ client: { url: `file:${dir}/test.db` } }),
    email: () => ({
      name: 'test',
      defaultFromAddress: 'auth@example.com',
      defaultFromName: 'Test',
      sendEmail: async (mail) => {
        delivered.push({ to: mail.to, html: mail.html })
      },
    }),
    collections: [
      {
        slug: 'users',
        auth: { useSessions: true, verify: true },
        access: { admin: () => false },
        fields: [],
      },
    ],
    plugins: [plugin],
  })
  const key = `email-overrides-${dir}`
  const payload = await getPayload({ config, key })
  try {
    for (const [email, verified] of [
      ['member@example.com', true],
      ['unverified@example.com', false],
    ] as const) {
      await payload.create({
        collection: 'users',
        overrideAccess: true,
        context: { authLoginCredentialProvisioning: true },
        disableVerificationEmail: true,
        data: { email, password: 'the river carries quiet dreams', _verified: verified },
      })
    }
    for (const [purpose, email, expected] of [
      ['login', 'member@example.com', 'login'],
      ['signup', 'new@example.com', 'signup'],
      ['recovery', 'member@example.com', 'password-reset'],
      ['verify-email', 'unverified@example.com', 'verify-email'],
    ]) {
      now += 2000
      const response = await handleEndpoints({
        config,
        payloadInstanceCacheKey: key,
        request: new Request('http://localhost:3000/api/auth/otp/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'accept-language': 'es-CO' },
          body: JSON.stringify({ email, purpose }),
        }),
      })
      expect(response.status).toBe(200)
      expect(seen.at(-1)).toMatchObject({
        purpose: expected,
        language: 'es',
        expiresInSeconds: 120,
      })
      expect(delivered.at(-1)?.to).toBe(email)
      expect(delivered.at(-1)?.html).toMatch(/^<p>\d{6}<\/p>$/)
    }
    expect(delivered).toHaveLength(4)
  } finally {
    await payload.destroy()
    await rm(dir, { recursive: true, force: true })
  }
})

it('does not duplicate a code in a custom subject and rejects code header injection', async () => {
  const params = { userName: 'Alex', otp: '123456' }
  expect(
    (
      await renderAuthEmail('otp', params, {
        otp: () => ({ subject: 'Sign in: 123456', html: '<p>123456</p>' }),
      })
    ).subject,
  ).toBe('Sign in: 123456')
  await expect(
    renderAuthEmail('otp', { ...params, otp: '123456\r\nBcc: other@example.com' }),
  ).rejects.toThrow('invalid email OTP')
})
