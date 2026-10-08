// @vitest-environment happy-dom
import React, { act, useContext } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  AuthConfigProvider,
  useAuthConfig,
} from '../src/auth/interface/react/providers/AuthConfigProvider'
import { AuthConfigContext } from '../src/contexts/AuthConfigContext'
import { createAuthService } from '../src/auth/interface/client/authService'
import { AuthCard } from '../src/components/organisms/AuthCard'
import { AuthPresentationContext, useAuthTranslations } from '../src/contexts/AuthAppearanceContext'
import {
  AuthServiceContext,
  matchesAuthTransport,
  createAuthServiceScope,
  useAuthService,
  type AuthService,
  type AuthServiceScope,
} from '../src/auth/interface/react/AuthServiceContext'
import { getUiTranslations } from '../src/i18n/ui'
import { normalizeAuthLocale } from '../src/i18n/locale'
import { selectEmailLocale } from '../src/auth/domain/emailPresentation'
import { otpEmail } from '../src/auth/server/otpEmail'
import { publicConfig } from './auth-test-config'

let root: Root
let host: HTMLDivElement
const services: Record<string, AuthService> = {}
const scopes: Record<string, AuthServiceScope | null> = {}
const configs: Record<string, ReturnType<typeof useAuthConfig>> = {}
function Probe({ id, locale }: { id: string; locale?: string }) {
  services[id] = useAuthService(locale)
  scopes[id] = useContext(AuthServiceContext)
  configs[id] = useAuthConfig()
  const t = useAuthTranslations(locale)
  return <output id={id}>{t.login.title}</output>
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true })),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})
async function render(node: React.ReactNode) {
  await act(async () => root.render(node))
}
async function language(id: string) {
  await services[id].login({ email: 'a@example.test', password: 'secret' })
  const call = vi.mocked(fetch).mock.calls.at(-1)!
  return new Headers(call[1]?.headers).get('Accept-Language')
}

it('inherits presentation in custom hooks without rewriting config and keeps the scope on reactive changes', async () => {
  const tree = (locale: string) => (
    <AuthConfigProvider publicConfig={publicConfig}>
      <AuthPresentationContext.Provider value={{ locale }}>
        <Probe id="shared" />
      </AuthPresentationContext.Provider>
    </AuthConfigProvider>
  )
  await render(tree('es'))
  const scope = scopes.shared
  const spanish = services.shared
  expect(configs.shared.locale).toBe('en')
  expect(host.textContent).toContain(getUiTranslations('es').login.title)
  expect(await language('shared')).toBe('es')
  await render(tree('en'))
  expect(scopes.shared).toBe(scope)
  expect(await language('shared')).toBe('en')
  await render(tree('es-CO'))
  expect(scopes.shared).toBe(scope)
  expect(services.shared).toBe(spanish)
  expect(await language('shared')).toBe('es')
})

it('honors local/card overrides and isolates sibling presentation/defaults sharing transport', async () => {
  const esConfig = { ...publicConfig, locale: 'es' as const }
  await render(
    <AuthConfigProvider publicConfig={publicConfig}>
      <AuthPresentationContext.Provider value={{ locale: 'es' }}>
        <Probe id="parent" />
        <Probe id="local" locale="en-US" />
        <AuthCard locale="en" poweredBy={{ enabled: false }}>
          <Probe id="card" />
        </AuthCard>
      </AuthPresentationContext.Provider>
      <AuthConfigProvider publicConfig={esConfig}>
        <AuthPresentationContext.Provider value={{ locale: 'fr' }}>
          <Probe id="unsupported" />
        </AuthPresentationContext.Provider>
      </AuthConfigProvider>
      <Probe id="sibling" />
    </AuthConfigProvider>,
  )
  expect(await language('parent')).toBe('es')
  expect(await language('local')).toBe('en')
  expect(await language('card')).toBe('en')
  expect(configs.card.locale).toBe('en')
  expect(scopes.card).toBe(scopes.parent)
  expect(scopes.unsupported).toBe(scopes.parent)
  expect(await language('unsupported')).toBe('es')
  expect(host.querySelector('#unsupported')?.textContent).toBe(getUiTranslations('es').login.title)
  expect(await language('sibling')).toBe('en')
})

it.each([
  ['es-CO', 'en', 'es'],
  ['en-US', 'es', 'en'],
  ['fr', 'es', 'es'],
  ['ES_mx', 'en', 'es'],
  ['es-MX;q=0.9,en;q=0.8', 'en', 'es'],
  ['es-invalid-!', 'en', 'en'],
  [undefined, 'es', 'es'],
] as const)(
  'normalizes %s consistently for HTTP and email fallback %s',
  async (locale, fallback, expected) => {
    const config = { ...publicConfig, locale: fallback }
    const service = createAuthService(config, locale)
    await service.login({ email: 'a@example.test', password: 'secret' })
    const header = new Headers(vi.mocked(fetch).mock.calls.at(-1)![1]?.headers).get(
      'Accept-Language',
    )
    expect(header).toBe(expected)
    expect(normalizeAuthLocale(locale, fallback)).toBe(expected)
    expect(selectEmailLocale(locale ?? null, fallback)).toBe(expected)
    expect(
      otpEmail('123456', { from: 'auth@example.test', locale: selectEmailLocale(header, fallback) })
        .html,
    ).toContain(`lang="${expected}"`)
  },
)

it('preserves custom dictionaries while unsupported transport uses installed fallback', async () => {
  await render(
    <AuthConfigProvider publicConfig={{ ...publicConfig, locale: 'es' }}>
      <AuthPresentationContext.Provider
        value={{ locale: 'fr', messages: { fr: { login: { title: 'Bonjour' } } } }}
      >
        <Probe id="custom" />
      </AuthPresentationContext.Provider>
    </AuthConfigProvider>,
  )
  expect(host.textContent).toBe('Bonjour')
  expect(await language('custom')).toBe('es')
})

it('does not treat language defaults as transport authority', () => {
  const scope = createAuthServiceScope(publicConfig)
  expect(matchesAuthTransport(scope, { ...publicConfig, locale: 'es' })).toBe(true)
  expect(matchesAuthTransport(scope, { ...publicConfig, apiPrefix: '/other' })).toBe(false)
})

it('retains cached adapters when presentation changes without a shared service scope', async () => {
  const tree = (locale: string) => (
    <AuthConfigContext.Provider value={publicConfig}>
      <AuthPresentationContext.Provider value={{ locale }}>
        <Probe id="unshared" />
      </AuthPresentationContext.Provider>
    </AuthConfigContext.Provider>
  )
  await render(tree('es'))
  const spanish = services.unshared
  expect(scopes.unshared).toBeNull()
  await render(tree('en'))
  expect(await language('unshared')).toBe('en')
  await render(tree('es'))
  expect(services.unshared).toBe(spanish)
})
