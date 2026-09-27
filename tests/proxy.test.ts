import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createAuthProxy } from '../src/proxy'
import { pluginConfig } from '../src/config'
import { safeAuthRedirect } from '../src/auth/domain/redirect'

beforeEach(() => { vi.stubEnv('AUTH_LOGIN_PROVIDER_CONFIG', ''); pluginConfig.modalLogin = false; pluginConfig.routeRedirects = true; vi.stubEnv('AUTH_LOGIN_MODAL_LOGIN', 'false') })
describe('modal redirect precedence', () => {
  it.each(['/login', '/signup', '/forgot-password', '/verify-otp', '/set-password', '/auth/login', '/admin/login'])('skips redirects for %s even with an explicit base path and cookie', path => {
    pluginConfig.modalLogin = true
    const response = createAuthProxy({ basePath: '/account' })(new NextRequest('https://example.com' + path, { headers: { cookie: 'payload-token=expired' } }))
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
  it('supports separately bundled proxy configuration', () => {
    const request = new NextRequest('https://example.com/login')
    expect(createAuthProxy({ modalLogin: true })(request).headers.get('location')).toBeNull()
    vi.stubEnv('AUTH_LOGIN_MODAL_LOGIN', 'true')
    expect(createAuthProxy()(request).headers.get('location')).toBeNull()
  })
  it('preserves existing page redirects when modal mode is disabled', () => {
    expect(createAuthProxy()(new NextRequest('https://example.com/login')).headers.get('location')).toBe('https://example.com/auth/login')
  })
})
describe('local destinations', () => {
  it.each(['https://evil.test', '//evil.test', '/foo/..//evil.test', '/\\evil.test', '/ /evil', 'javascript:alert(1)'])('rejects %s', value => expect(safeAuthRedirect(value)).toBe('/'))
  it('preserves paths, queries and hashes', () => expect(safeAuthRedirect('/products?q=books#details')).toBe('/products?q=books#details'))
})


describe('signup routing', () => {
  it('does not redirect the signup page to Login when signup is disabled', () => {
    pluginConfig.allowSignup = false
    vi.stubEnv('AUTH_LOGIN_ALLOW_SIGNUP', 'false')
    const proxy = createAuthProxy()
    expect(proxy(new NextRequest('https://example.com/auth/signup')).headers.get('location')).toBeNull()
    expect(proxy(new NextRequest('https://example.com/signup')).headers.get('location')).toBe('https://example.com/auth/signup')
  })
  it('reads routing settings initialized by the plugin factory', () => {
    vi.stubEnv('AUTH_LOGIN_PROVIDER_CONFIG', JSON.stringify({ authBasePath: '/account', routeRedirects: true }))
    expect(createAuthProxy()(new NextRequest('https://example.com/login')).headers.get('location')).toBe('https://example.com/account/login')
  })
})
