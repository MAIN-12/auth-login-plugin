// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth, type AuthContextValue } from '../src/components/AuthProvider'
import { AuthProvider as ServerAuthProvider } from '../src/components/AuthProviderServer'
import { AuthCard, AuthPages, AuthClientInit, useAuthConfig } from '../src/exports/client'
import { AuthCard as ServerAuthCard } from '../src/components/AuthCardServer'
import ServerAuthPages from '../src/components/AuthPagesServer'
import { AuthLayout } from '../src/components/templates/AuthLayout'
import { PoweredBy } from '../src/components/molecules/PoweredBy'
import {
  LoginForm,
  SignupForm,
  ForgotPasswordForm,
  VerifyOtpForm,
  SetPasswordForm,
} from '../src/components/organisms/forms'
import LoginPage from '../src/components/pages/LoginPage'
import SignupPage from '../src/components/pages/SignupPage'
import ForgotPasswordPage from '../src/components/pages/ForgotPasswordPage'
import VerifyOtpPage from '../src/components/pages/VerifyOtpPage'
import SetPasswordPage from '../src/components/pages/SetPasswordPage'
import {
  useAuthPresentation,
  useAuthTranslations,
} from '../src/components/auth-presentation/AuthPresentationContext'
import { getUiTranslations } from '../src/components/ui/translations'
import { publicConfig } from './auth-test-config'
import { AuthConfigProvider } from '../src/components/AuthConfigContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`email=member@example.com&context=${'a'.repeat(64)}`),
  redirect: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'accept-language': 'en' }) }))

let root: Root
let host: HTMLDivElement
let auth: AuthContextValue
const login = async () => {}
const signup = async () => {}
const sharedMessages = {
  es: {
    login: { title: 'Shared title', subtitle: 'Shared subtitle', continue: 'Shared continue' },
  },
}
function AuthProbe() {
  auth = useAuth()
  return null
}
function PresentationProbe() {
  const { locale, style } = useAuthPresentation()
  const t = useAuthTranslations()
  return (
    <output>
      {locale}|{style}|{t.login.title}
    </output>
  )
}
async function render(node: React.ReactNode) {
  await act(async () =>
    root.render(<AuthConfigProvider publicConfig={publicConfig}>{node}</AuthConfigProvider>),
  )
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  document.documentElement.lang = 'en'
  for (const key of [
    'AUTH_LOGIN_PROVIDER_CONFIG',
    'AUTH_LOGIN_ALLOW_SIGNUP',
    'AUTH_LOGIN_GOOGLE_OAUTH',
  ])
    vi.stubEnv(key, '')
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ user: null })),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('shared presentation', () => {
  it('inherits undefined modal branding and disables explicit null logos and false attribution', async () => {
    await render(
      <AuthProvider
        publicConfig={publicConfig}
        initialUser={null}
        modalLogin
        locale="es"
        logo={<span>Parent brand</span>}
        messages={sharedMessages}
        poweredBy={{ enabled: true, linkUrl: 'https://example.com/credits' }}
        authCardProps={{
          locale: undefined,
          logo: null,
          poweredBy: { enabled: false },
          messages: { es: { login: { title: 'Modal title' } } },
        }}
      >
        <AuthCard slug="login" logo={undefined} mobileVariant="modal" />
        <AuthProbe />
      </AuthProvider>,
    )
    expect(host.textContent).toContain('Parent brand')
    expect(host.querySelector('a[href="https://example.com/credits"]')).toBeTruthy()
    await act(async () => auth.openLogin())
    const dialog = document.querySelector('dialog')!
    expect(dialog.querySelector('h1')?.textContent).toBe('Modal title')
    expect(dialog.textContent).toContain('Shared subtitle')
    expect(dialog.textContent).toContain('Shared continue')
    expect(dialog.textContent).not.toContain('Parent brand')
    expect(dialog.querySelector('img, a[href="https://example.com/credits"]')).toBeNull()
    expect(dialog.querySelectorAll('form')).toHaveLength(1)
  })
  it('shares branding and translated copy between a page and the login modal', async () => {
    await render(
      <AuthProvider
        publicConfig={publicConfig}
        initialUser={null}
        modalLogin
        locale="es"
        logo={<span data-brand>Shared brand</span>}
        messages={sharedMessages}
        poweredBy={{ enabled: false }}
      >
        <AuthPages slug={['login']} mobileVariant="modal" showGoogleOAuth={false} />
        <AuthProbe />
      </AuthProvider>,
    )
    expect(host.querySelector('h1')?.textContent).toBe('Shared title')
    expect(host.querySelector('[data-brand]')).toBeTruthy()
    await act(async () => auth.openLogin())
    const dialog = document.querySelector('dialog')!
    expect(dialog.querySelector('h1')?.textContent).toBe('Shared title')
    expect(dialog.querySelector('[data-brand]')).toBeTruthy()
    expect(dialog.textContent).toContain('Shared continue')
    expect(document.querySelector('a[href="https://main12.com"]')).toBeNull()
  })
  it('lets a card override individual translation keys and branding for its child forms', async () => {
    await render(
      <AuthProvider
        publicConfig={publicConfig}
        initialUser={null}
        locale="es"
        messages={sharedMessages}
        logo={<span>Shared brand</span>}
      >
        <AuthCard
          slug="login"
          mobileVariant="modal"
          logo={<span>Local brand</span>}
          messages={{ es: { login: { title: 'Local title' } } }}
        />
        <AuthCard locale="en" logo={null} mobileVariant="modal">
          <LoginForm onPasswordLogin={login} />
        </AuthCard>
      </AuthProvider>,
    )
    expect(host.querySelector('h1')?.textContent).toBe('Local title')
    expect(host.textContent).toContain('Shared subtitle')
    expect(host.textContent).toContain('Local brand')
    expect(host.textContent).not.toContain('Shared brand')
    expect(host.textContent).toContain(getUiTranslations('en').login.continue)
    expect(host.querySelector('img[src="/plugin-logo.svg"]')).toBeNull()
  })
  it('keeps authCardProps overrides scoped to the modal', async () => {
    await render(
      <AuthProvider
        publicConfig={publicConfig}
        initialUser={null}
        modalLogin
        locale="es"
        logo={<span>Shared brand</span>}
        authCardProps={{ locale: 'en', logo: <span>Modal brand</span> }}
      >
        <AuthCard slug="login" mobileVariant="modal" />
        <AuthProbe />
      </AuthProvider>,
    )
    expect(host.querySelector('h1')?.textContent).toBe(getUiTranslations('es').login.title)
    await act(async () => auth.openLogin())
    expect(document.querySelector('dialog h1')?.textContent).toBe(
      getUiTranslations('en').login.title,
    )
    expect(document.querySelector('dialog')?.textContent).toContain('Modal brand')
    expect(host.textContent).toContain('Shared brand')
  })
  it('isolates sibling providers and follows nested provider overrides reactively', async () => {
    const tree = (locale: string) => (
      <>
        <AuthProvider
          publicConfig={publicConfig}
          initialUser={null}
          locale={locale}
          style="hero-ui"
          messages={sharedMessages}
        >
          <section id="parent">
            <PresentationProbe />
          </section>
          <AuthProvider publicConfig={publicConfig} initialUser={null} locale="en" style="tailwind">
            <section id="nested">
              <PresentationProbe />
            </section>
          </AuthProvider>
        </AuthProvider>
        <AuthProvider publicConfig={publicConfig} initialUser={null} locale="en">
          <section id="sibling">
            <PresentationProbe />
          </section>
        </AuthProvider>
      </>
    )
    await render(tree('es'))
    expect(host.querySelector('#parent')?.textContent).toBe('es|hero-ui|Shared title')
    expect(host.querySelector('#nested')?.textContent).toContain('en|tailwind|')
    expect(host.querySelector('#sibling')?.textContent).toContain('en|tailwind|')
    expect(publicConfig.style).toBe('tailwind')
    await render(tree('en'))
    expect(host.querySelector('#parent')?.textContent).toContain('en|hero-ui|')
  })
  it('inherits attribution directly and permits field overrides', async () => {
    await render(
      <AuthProvider
        publicConfig={publicConfig}
        initialUser={null}
        poweredBy={{ enabled: false, linkUrl: 'https://example.com' }}
      >
        <section id="hidden">
          <PoweredBy />
        </section>
        <section id="shown">
          <PoweredBy enabled />
        </section>
      </AuthProvider>,
    )
    expect(host.querySelector('#hidden a')).toBeNull()
    expect(host.querySelector('#shown a')?.getAttribute('href')).toBe('https://example.com')
  })
  it('works without a provider and keeps AuthLayout independent of presentation', async () => {
    document.documentElement.lang = 'es'
    await render(
      <AuthLayout backgroundClass="bg-white" verticalAlign="top">
        <AuthCard slug="login" mobileVariant="modal" />
      </AuthLayout>,
    )
    expect(host.querySelector('h1')?.textContent).toBe(getUiTranslations('en').login.title)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/plugin-logo.svg')
    expect(host.querySelector('main')?.className).toContain('bg-white')
    expect(host.querySelector('main > div')?.className).toContain('justify-start')
  })
})

describe('forms and standalone pages', () => {
  it.each(['tailwind', 'hero-ui'] as const)(
    '%s dispatcher preserves all five screens and unknown-slug fallback',
    async (style) => {
      const config = { ...publicConfig, allowSignup: true, recovery: true, otpLogin: true }
      const screens = [
        ['login', 'login'],
        ['signup', 'signup'],
        ['forgot-password', 'forgotPassword'],
        ['verify-otp', 'verifyOtp'],
        ['set-password', 'setPassword'],
        ['unknown', 'login'],
      ] as const
      for (const [slug, section] of screens) {
        await render(
          <AuthClientInit publicConfig={config}>
            <AuthPages
              key={slug}
              slug={[slug]}
              style={style}
              locale="en"
              mobileVariant="modal"
              texture="none"
            />
          </AuthClientInit>,
        )
        await vi.waitFor(
          async () => {
            await act(async () => {})
            expect(host.querySelector('h1')?.textContent).toBe(
              getUiTranslations('en')[section].title,
            )
          },
          { timeout: 5000 },
        )
        expect(host.querySelectorAll('form').length).toBeLessThanOrEqual(1)
        expect(host.querySelectorAll('input[type=email]').length).toBeLessThanOrEqual(1)
      }
    },
  )
  it.each(['tailwind', 'hero-ui'] as const)(
    '%s custom content stays mounted once across responsive variants',
    async (style) => {
      let maximumLive = 0
      let live = 0
      function CustomForm() {
        React.useEffect(() => {
          live++
          maximumLive = Math.max(maximumLive, live)
          return () => {
            live--
          }
        }, [])
        return (
          <form>
            <input aria-label="Custom workflow" defaultValue="Keep my value" />
          </form>
        )
      }
      for (const mobileVariant of ['plain', 'card', 'modal'] as const) {
        await render(
          <AuthCard style={style} mobileVariant={mobileVariant} title="Custom title" logo={null}>
            <CustomForm />
          </AuthCard>,
        )
        await vi.waitFor(
          async () => {
            await act(async () => {})
            expect(host.querySelectorAll('form')).toHaveLength(1)
          },
          { timeout: 5000 },
        )
        expect(live).toBe(1)
        expect(maximumLive).toBe(1)
        expect(host.querySelector('input')?.value).toBe('Keep my value')
      }
    },
  )
  const cases: Array<[string, React.ReactNode, string]> = [
    ['login form', <LoginForm onPasswordLogin={login} />, getUiTranslations('es').login.continue],
    ['signup form', <SignupForm onSignup={signup} />, getUiTranslations('es').signup.createAccount],
    [
      'forgot password form',
      <ForgotPasswordForm />,
      getUiTranslations('es').forgotPassword.sendResetCode,
    ],
    ['OTP form', <VerifyOtpForm />, getUiTranslations('es').verifyOtp.verify],
    ['set password form', <SetPasswordForm />, getUiTranslations('es').setPassword.setPassword],
    ['login page', <LoginPage onPasswordLogin={login} />, getUiTranslations('es').login.title],
    ['signup page', <SignupPage onSignup={signup} />, getUiTranslations('es').signup.title],
    ['forgot password page', <ForgotPasswordPage />, getUiTranslations('es').forgotPassword.title],
    ['OTP page', <VerifyOtpPage />, getUiTranslations('es').verifyOtp.title],
    ['set password page', <SetPasswordPage />, getUiTranslations('es').setPassword.title],
  ]
  it.each(cases)('%s inherits the provider locale', async (_name, component, expected) => {
    await render(
      <AuthProvider publicConfig={publicConfig} initialUser={null} locale="es">
        {component}
      </AuthProvider>,
    )
    expect(host.textContent).toContain(expected)
  })
})

describe('server defaults versus provider overrides', () => {
  it('keeps initializer context scalar and excludes extra private caller fields', async () => {
    let captured: unknown
    function ConfigProbe() {
      captured = useAuthConfig()
      return null
    }
    const extended = {
      ...publicConfig,
      secret: 'private-test-secret',
      providers: { google: { clientSecret: 'private-test-oauth' } },
    }
    await render(
      <AuthClientInit publicConfig={extended}>
        <ConfigProbe />
      </AuthClientInit>,
    )
    expect(captured).toEqual(publicConfig)
    expect(Object.isFrozen(captured)).toBe(true)
    expect(JSON.stringify(captured)).not.toMatch(/private-test|clientSecret|providers/)
  })
  it.each(['card', 'pages', 'custom card'] as const)(
    '%s retains provider language and branding across the server boundary',
    async (kind) => {
      const content =
        kind === 'card'
          ? await ServerAuthCard({ publicConfig, slug: 'login', mobileVariant: 'modal' })
          : kind === 'pages'
            ? await ServerAuthPages({ publicConfig, slug: ['login'], mobileVariant: 'modal' })
            : await ServerAuthCard({
                publicConfig,
                children: <LoginForm onPasswordLogin={login} />,
                mobileVariant: 'modal',
              })
      await render(
        <AuthProvider
          publicConfig={publicConfig}
          initialUser={null}
          locale="es"
          messages={sharedMessages}
          logo={<span>Provider brand</span>}
        >
          {content}
        </AuthProvider>,
      )
      expect(host.textContent).toContain('Shared continue')
      expect(host.textContent).toContain('Provider brand')
      expect(host.querySelector('img[src="/plugin-logo.svg"]')).toBeNull()
    },
  )
  it('uses detected server language without a provider and honors explicit RSC overrides', async () => {
    document.documentElement.lang = 'es'
    await render(await ServerAuthCard({ publicConfig, slug: 'login', mobileVariant: 'modal' }))
    expect(host.querySelector('h1')?.textContent).toBe(getUiTranslations('en').login.title)
    const content = await ServerAuthCard({
      publicConfig,
      slug: 'login',
      locale: 'en',
      logo: null,
      mobileVariant: 'modal',
    })
    await render(
      <AuthProvider
        publicConfig={publicConfig}
        initialUser={null}
        locale="es"
        logo={<span>Provider brand</span>}
      >
        {content}
      </AuthProvider>,
    )
    expect(host.querySelector('h1')?.textContent).toBe(getUiTranslations('en').login.title)
    expect(host.textContent).not.toContain('Provider brand')
  })
  it('does not let an inner server provider replace explicit parent presentation with request defaults', async () => {
    const content = await ServerAuthProvider({
      publicConfig,
      initialUser: null,
      children: <PresentationProbe />,
    })
    await render(
      <AuthProvider publicConfig={publicConfig} initialUser={null} locale="es" style="hero-ui">
        {content}
      </AuthProvider>,
    )
    expect(host.querySelector('output')?.textContent).toContain('es|hero-ui|')
  })
})

describe('plugin signup setting', () => {
  it.each(['card', 'pages', 'provider'] as const)(
    '%s renders Login at the signup URL when disabled',
    async (kind) => {
      vi.stubEnv('AUTH_LOGIN_ALLOW_SIGNUP', 'false')
      window.history.replaceState({}, '', '/auth/signup?redirect=/account')
      const content =
        kind === 'card'
          ? await ServerAuthCard({ publicConfig, slug: 'signup', mobileVariant: 'modal' })
          : kind === 'pages'
            ? await ServerAuthPages({ publicConfig, slug: ['signup'], mobileVariant: 'modal' })
            : await ServerAuthProvider({
                publicConfig,
                initialUser: null,
                children: <AuthCard slug="signup" mobileVariant="modal" />,
              })
      await render(content)
      expect(host.querySelector('h1')?.textContent).toBe(getUiTranslations('en').login.title)
      expect(host.querySelector('a[href*="signup"]')).toBeNull()
      expect(window.location.pathname + window.location.search).toBe(
        '/auth/signup?redirect=/account',
      )
      const { redirect } = await import('next/navigation')
      expect(redirect).not.toHaveBeenCalled()
    },
  )
})

describe('configured style renders actual controls', () => {
  it.each(['hero-ui', 'tailwind'] as const)(
    'uses %s controls from server plugin settings',
    async (style) => {
      const styledConfig = { ...publicConfig, style }
      await import('../src/components/atoms/adapters/hero')
      const content = await ServerAuthProvider({
        publicConfig: styledConfig,
        initialUser: null,
        children: <AuthCard slug="login" mobileVariant="modal" showGoogleOAuth={false} />,
      })
      await render(content)
      const button = host.querySelector('button[type="submit"]')!
      const input = host.querySelector('input[type="email"]')!
      expect(button).toBeTruthy()
      expect(input).toBeTruthy()
      expect(button.classList.contains('button')).toBe(style === 'hero-ui')
      expect(input.classList.contains('input')).toBe(style === 'hero-ui')
      expect(host.querySelector('.card') !== null).toBe(style === 'hero-ui')
    },
  )
})
