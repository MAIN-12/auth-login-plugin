import { expect, it, vi } from 'vitest'
import { authLoginPlugin } from '../src/index'
vi.mock('payload-oauth2', () => ({ OAuth2Plugin: () => (config: unknown) => config }))


it('captures explicit public settings per instance without touching process environment', async () => {
  const env = { ...process.env }
  const first = authLoginPlugin({ collection: 'customers', passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: false, recovery: false, logo: '/first.svg' })
  const second = authLoginPlugin({ collection: 'members', passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: false, recovery: false, logo: '/second.svg' })
  expect(first.publicConfig.collection).toBe('customers')
  expect(second.publicConfig.logoUrl).toBe('/second.svg')
  expect(first.publicConfig.logoUrl).toBe('/first.svg')
  expect(Object.isFrozen(first.publicConfig)).toBe(true)
  expect(process.env).toEqual(env)
})
it('rejects auth collections without email verification evidence enforcement', async () => {
  const plugin = authLoginPlugin({ passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: false, recovery: false })
  await expect(plugin({ collections: [{ slug: 'users', auth: { useSessions: true }, fields: [] }] })).rejects.toThrow('verify')
})
it('has a completely inert disabled factory without requiring enabled-flow options', async () => {
  const config = { collections: [] }
  const env = { ...process.env }
  const disabled = authLoginPlugin({ enabled: false })
  expect(await disabled(config)).toBe(config)
  expect(disabled.publicConfig).toBeNull()
  expect(process.env).toEqual(env)
})
const enabledOptions = { passwordLogin: true, otpLogin: false, providers: { google: false as const }, allowSignup: false, recovery: false }
it.each([
  { passwordLogin: undefined }, { passwordLogin: false }, { otpLogin: 'false' }, { modalLogin: 'true' }, { enabled: 'false' },
  { style: 'unknown' }, { logo: () => null }, { projectName: {} }, { apiPrefix: '/api/' }, { collection: 'bad/name' },
  { providers: { google: true } }, { session: null }, { session: { maxAge: 0 } }, { session: { maxAge: 1.5 } },
])('rejects incompatible runtime options without touching environment: %j', invalid => {
  const environment = { ...process.env }
  expect(() => authLoginPlugin({ ...enabledOptions, ...invalid } as never)).toThrow('auth-login:')
  expect(process.env).toEqual(environment)
})
it.each([
  false, { useSessions: false, verify: true }, { useSessions: true, verify: true, disableLocalStrategy: true },
  { useSessions: true, verify: true, useAPIKey: true }, { useSessions: true, verify: true, tokenExpiration: 0 },
  { useSessions: true, verify: true, tokenExpiration: '7200' },
])('rejects unsupported native collection authentication: %j', auth => {
  const plugin = authLoginPlugin(enabledOptions)
  return expect(plugin({ collections: [{ slug: 'users', auth, fields: [] }] } as never)).rejects.toThrow('auth-login:')
})
it('does not mutate collection settings or observe caller mutations after constructing a factory', async () => {
  const options = { ...enabledOptions, session: { maxAge: 60 } }
  const plugin = authLoginPlugin(options)
  options.passwordLogin = false
  options.session.maxAge = 3600
  const input = { collections: [{ slug: 'users', auth: { useSessions: true, verify: true, tokenExpiration: 30 }, fields: [] }] }
  const original = structuredClone(input)
  const output = await plugin(input)
  expect(input).toEqual(original)
  expect(output.collections?.[0].auth).toMatchObject({ tokenExpiration: 30 })
  expect(plugin.publicConfig.passwordLogin).toBe(true)
})
