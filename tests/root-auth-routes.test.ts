import { afterEach, expect, it, vi } from 'vitest'
import { resolveAuthConfig, type AuthLoginPluginOptions } from '../src/config'
import { authRoute } from '../src/auth/interface/react/AuthFlowContext'
import { createAuthService } from '../src/auth/interface/client/authService'

const options: AuthLoginPluginOptions = {
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
}
afterEach(() => vi.unstubAllGlobals())

it('publishes an immutable empty frontend base path without changing API prefixes', () => {
  const config = resolveAuthConfig({ ...options, basePath: '' })
  expect(config.authBasePath).toBe('')
  expect(Object.isFrozen(config)).toBe(true)
  expect(JSON.parse(JSON.stringify(config)).authBasePath).toBe('')
  expect(config.apiPrefix).toBe('/api')
  expect(config.authEndpointPrefix).toBe('/auth')
  for (const slug of ['login', 'signup', 'verify-otp', 'set-password']) {
    expect(authRoute(config.authBasePath, slug)).toBe(`/${slug}`)
  }
  expect(authRoute(config.authBasePath, 'verify-otp', { purpose: 'signup' }, '/checkout')).toBe(
    '/verify-otp?purpose=signup&redirect=%2Fcheckout',
  )
  expect(authRoute(config.authBasePath, 'login', {}, '//evil.test')).toBe('/login')
})

it('keeps the default nested routes and explicit legacy root mount', () => {
  expect(resolveAuthConfig(options).authBasePath).toBe('/auth')
  expect(resolveAuthConfig({ ...options, routeRedirects: { basePath: '' } }).authBasePath).toBe('')
})

it('root frontend presentation still calls the configured API transport', async () => {
  const config = resolveAuthConfig({
    ...options,
    basePath: '',
    apiPrefix: '/backend',
    authEndpointPrefix: '/identity',
  })
  const fetch = vi.fn().mockResolvedValue(Response.json({ user: null }))
  vi.stubGlobal('fetch', fetch)
  const service = createAuthService(config)
  await expect(service.session()).resolves.toBeNull()
  expect(fetch).toHaveBeenCalledWith('/backend/users/me', expect.any(Object))
  fetch.mockResolvedValue(Response.json({ success: true }))
  await expect(
    service.login({ email: 'a@example.test', password: 'unused' }),
  ).resolves.toBeUndefined()
  expect(fetch).toHaveBeenCalledWith('/backend/identity/login', expect.any(Object))
})

it.each([
  '',
  '/',
  '//evil.test',
  '/a//b',
  '/../login',
  '/auth/',
  '/auth?next=x',
  '/auth#x',
  '/%2fauth',
  'https://evil.test',
])('does not relax API path validation for %j', (prefix) => {
  for (const field of ['apiPrefix', 'authEndpointPrefix'] as const) {
    expect(() => resolveAuthConfig({ ...options, basePath: '', [field]: prefix })).toThrow(
      `invalid ${field}`,
    )
  }
})

it.each([
  '/',
  '//evil.test',
  '/../login',
  '/auth/',
  '/auth?next=x',
  '/auth#x',
  '/%2fauth',
  'https://evil.test',
])('still rejects unsafe nonempty frontend basePath %j', (basePath) => {
  expect(() => resolveAuthConfig({ ...options, basePath })).toThrow('invalid basePath')
})
