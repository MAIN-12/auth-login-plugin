import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService, AuthRequestError } from '../src/auth/interface/client/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('never exposes an infrastructure response or trusts an invalid successful OTP response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('private infrastructure detail', { status: 503 })),
  )
  await expect(
    createAuthService({ ...publicConfig, otpLogin: true }).sendOtp('a@example.test'),
  ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 })
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, context: 123 }))
  await expect(
    createAuthService({ ...publicConfig, otpLogin: true }).sendOtp('a@example.test'),
  ).rejects.toBeInstanceOf(AuthRequestError)
})
import {
  generateOtpEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail,
} from '../src/auth/infrastructure/email'
it('exported email generators escape branding and names without showing OTP in previews', () => {
  const baseOptions = {
    projectName: '<Brand>',
    contactEmail: 'support@example.test',
    domain: 'https://example.test',
    colors: { primary: '#123456' },
  }
  const email = generateOtpEmail({
    userName: '<script>secret</script>',
    otp: '123456',
    language: 'es',
    baseOptions,
  })
  expect(email.subject).not.toContain('123456')
  expect(email.html).not.toContain('<script>')
  expect(email.html).toContain('&lt;Brand&gt;')
  expect(email.html).toContain('support@example.test')
  expect(email.html).toContain('#123456')
  expect(
    generatePasswordResetEmail({ userName: 'A', otp: '123456', baseOptions }).html.match(
      /display:none[^>]*>([^<]*)/,
    )?.[1],
  ).not.toContain('123456')
  expect(() => generateWelcomeEmail({ userName: 'A', loginUrl: 'javascript:alert(1)' })).toThrow()
})
import { createPasswordLoginEndpoint } from '../src/auth/composition/passwordLogin'
it('failed password login returns a correlation identifier without logging submitted secrets', async () => {
  const events: unknown[] = []
  const req = {
    headers: new Headers({ 'content-type': 'application/json' }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            JSON.stringify({ email: 'a@example.test', password: 'secret submitted' }),
          ),
        )
        controller.close()
      },
    }),
    payload: {
      config: { csrf: [] },
      collections: {},
      logger: { info: (event: unknown) => events.push(event) },
    },
  } as unknown as Parameters<ReturnType<typeof createPasswordLoginEndpoint>['handler']>[0]
  const response = await createPasswordLoginEndpoint({
    ...publicConfig,
    passwordLogin: false,
  }).handler(req)
  expect(response.headers.get('X-Auth-Request-ID')).toMatch(/^[\w-]{36}$/)
  expect(JSON.stringify(events)).toContain('auth.login.rejected')
  expect(JSON.stringify(events)).not.toContain('secret submitted')
})
import { resolveAuthConfig } from '../src/config'
it('explicit locale and HTTPS branding validate before any configuration is published', () => {
  expect(
    resolveAuthConfig({
      passwordLogin: true,
      otpLogin: false,
      providers: { google: false },
      allowSignup: false,
      recovery: false,
      locale: 'es',
    }).locale,
  ).toBe('es')
  expect(() =>
    resolveAuthConfig({
      passwordLogin: true,
      otpLogin: false,
      providers: { google: false },
      allowSignup: false,
      recovery: false,
      logo: 'javascript:alert(1)',
    }),
  ).toThrow()
})
import { authRoute } from '../src/auth/interface/react/AuthFlowContext'
it('configured navigation retains local query/hash and rejects encoded external bypasses', () => {
  expect(authRoute('/members', 'login', {}, '/checkout?item=1#payment')).toBe(
    '/members/login?redirect=%2Fcheckout%3Fitem%3D1%23payment',
  )
  expect(authRoute('/members', 'login', {}, '/%252f%252fevil.test')).toBe('/members/login')
})
it('limited proof purpose comes from the explicit operation, not an untrusted response field', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ success: true, permit: 'opaque', expiresAt: Date.now() + 300000 }),
      ),
  )
  expect(
    await createAuthService(publicConfig).verifyOwnership(
      'a@example.test',
      'recovery',
      '123456',
      'a'.repeat(64),
    ),
  ).toMatchObject({ purpose: 'recovery', permit: 'opaque' })
})
