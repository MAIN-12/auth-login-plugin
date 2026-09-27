import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Config } from 'payload'
import { authLoginPlugin } from '../src/index'
import { getServerProviderConfig, pluginConfig } from '../src/config'
import { AuthProvider } from '../src/components/AuthProviderServer'

const oauth = vi.hoisted(() => ({ options: null as any }))
vi.mock('payload-oauth2', () => ({ OAuth2Plugin: (options: any) => { oauth.options = options; return (config: Config) => config } }))
vi.mock('../src/endpoints/authEndpoints', () => ({ authEndpoints: [] }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'accept-language': 'es' }) }))

beforeEach(() => {
  for (const key of ['AUTH_LOGIN_MODAL_LOGIN', 'AUTH_LOGIN_PROVIDER_CONFIG', 'AUTH_LOGIN_ALLOW_SIGNUP', 'AUTH_LOGIN_GOOGLE_OAUTH', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) vi.stubEnv(key, '')
})
afterEach(() => vi.unstubAllEnvs())

it('passes plugin settings and locale through the server provider without credentials', async () => {
  await authLoginPlugin({ modalLogin: true, style: 'hero-ui', allowSignup: false, passwordLogin: false, otpLogin: true, logo: '/brand.svg', routeRedirects: { basePath: '/account' } })({} as Config)
  const provider = await AuthProvider({ children: 'page' })
  expect(provider.props.value).toMatchObject({ style: 'hero-ui', locale: 'es' })
  expect(provider.props.children.props.children.props).toMatchObject({ modalLogin: true, basePath: '/account', authCardProps: { passwordLogin: false, otpLogin: true, showGoogleOAuth: false } })
  expect(provider.props.children.props.enabled).toBe(false)
  expect(pluginConfig.routeRedirects).toBe(false)
  expect(getServerProviderConfig()).not.toHaveProperty('providers')
})

it('allows explicit provider overrides and restores page mode on reconfiguration', async () => {
  await authLoginPlugin({ modalLogin: true, style: 'hero-ui' })({} as Config)
  const provider = await AuthProvider({ children: 'page', modalLogin: false, style: 'tailwind', authCardProps: { locale: 'en' } })
  expect(provider.props.children.props.children.props).toMatchObject({ modalLogin: false, style: 'tailwind', authCardProps: { locale: 'en' } })
  await authLoginPlugin({ routeRedirects: true })({} as Config)
  expect(pluginConfig.modalLogin).toBe(false)
  expect(pluginConfig.routeRedirects).toBe(true)
})

it('returns OAuth to local modal destinations and keeps a usable failure page', async () => {
  await authLoginPlugin({ modalLogin: true, providers: { google: { clientId: 'test-id', clientSecret: 'test-secret' } } })({} as Config)
  expect(oauth.options.successRedirect({ searchParams: new URLSearchParams({ state: '/products?q=books#details' }) })).toBe('/products?q=books#details')
  expect(oauth.options.successRedirect({ searchParams: new URLSearchParams({ state: '//evil.test' }) })).toBe('/')
  expect(oauth.options.failureRedirect()).toBe('/auth/login?error=Google%20login%20failed')
  expect(JSON.stringify(getServerProviderConfig())).not.toContain('test-secret')
})
