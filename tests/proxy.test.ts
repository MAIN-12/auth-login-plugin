import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createAuthProxy } from '../src/proxy'
import { publicConfig } from './auth-test-config'
import { safeAuthRedirect } from '../src/auth/domain/redirect'

describe('explicit proxy configuration', () => {
  it.each(['/login', '/signup', '/auth/login', '/admin/login'])(
    'skips %s in modal mode even with an arbitrary cookie',
    (path) => {
      const proxy = createAuthProxy({
        publicConfig: { ...publicConfig, modalLogin: true },
        basePath: '/account',
      })
      expect(
        proxy(
          new NextRequest('https://example.com' + path, {
            headers: { cookie: 'payload-token=expired' },
          }),
        ).headers.get('location'),
      ).toBeNull()
    },
  )
  it('canonicalizes paths without treating a cookie as evidence of authentication', () => {
    const proxy = createAuthProxy({
      publicConfig: { ...publicConfig, authBasePath: '/account', routeRedirects: true },
    })
    expect(
      proxy(
        new NextRequest('https://example.com/login?redirect=//evil.test', {
          headers: { cookie: 'payload-token=forged' },
        }),
      ).headers.get('location'),
    ).toBe('https://example.com/account/login?redirect=//evil.test')
    expect(
      proxy(
        new NextRequest('https://example.com/account/login', {
          headers: { cookie: 'payload-token=forged' },
        }),
      ).headers.get('location'),
    ).toBeNull()
  })
  it('has no implicit redirect settings', () =>
    expect(
      createAuthProxy()(new NextRequest('https://example.com/login')).headers.get('location'),
    ).toBeNull())
})
describe('local destinations', () => {
  it.each([
    'https://evil.test',
    '//evil.test',
    '/foo/..//evil.test',
    '/\\evil.test',
    '/ /evil',
    'javascript:alert(1)',
  ])('rejects %s', (value) => expect(safeAuthRedirect(value)).toBe('/'))
  it('preserves paths, queries and hashes', () =>
    expect(safeAuthRedirect('/products?q=books#details')).toBe('/products?q=books#details'))
})
