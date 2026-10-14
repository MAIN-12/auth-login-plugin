// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthPages, AuthConfigProvider } from '../src/exports/client'
import { AuthFlowContext } from '../src/authentication/interface/react/AuthFlowContext'
import { publicConfig } from './auth-test-config'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let host: HTMLDivElement
const config = { ...publicConfig, authBasePath: '/members', allowSignup: true, recovery: true }
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function mount(node: React.ReactNode, overrides = {}, query = 'redirect=%2Faccount') {
  const push = vi.fn()
  const complete = vi.fn(async () => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () =>
    root.render(
      <AuthConfigProvider publicConfig={{ ...config, ...overrides }}>
        <AuthFlowContext.Provider
          value={{ push, complete, searchParams: new URLSearchParams(query) }}
        >
          {node}
        </AuthFlowContext.Provider>
      </AuthConfigProvider>,
    ),
  )
  await vi.waitFor(
    async () => {
      await act(async () => {})
      expect(host.querySelector('input, button')).toBeTruthy()
    },
    { timeout: 5000 },
  )
  return { push, complete }
}

it.each([
  ['tailwind', 'signup'],
  ['hero-ui', 'signup'],
  ['tailwind', 'login'],
  ['hero-ui', 'login'],
] as const)(
  'offers one labeled Google action with a decorative icon in %s %s',
  async (style, slug) => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    await mount(<AuthPages slug={[slug]} style={style} texture="none" locale="es" />, {
      googleOAuthEnabled: true,
    })
    const google = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Google'),
    )!
    expect(google.textContent).toContain('Google')
    expect(google.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    await act(async () => google.click())
    expect(assign).toHaveBeenCalledExactlyOnceWith('/api/auth/oauth/google?returnTo=%2Faccount')
  },
)

async function enter(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function submit() {
  await act(async () =>
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
const context = 'a'.repeat(64)
const strongPassword = 'the river carries quiet dreams'

import { storePasswordProof } from '../src/collections/AuthLoginPasswordPermits/interface/client/passwordProof'
import { SignupPage, ForgotPasswordPage, SetPasswordPage } from '../src/exports/client'

it.each(['tailwind', 'hero-ui'] as const)(
  'continues signup and recovery through ownership, shared OTP and password back to login in %s',
  async (style) => {
    for (const purpose of ['signup', 'recovery'] as const) {
      const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        Response.json({ success: true, context, retryAfter: 60 }),
      )
      vi.stubGlobal('fetch', request)
      const callback = vi.fn(async () => {})
      const { push, complete } = await mount(
        <AuthPages
          slug={[purpose === 'signup' ? 'signup' : 'forgot-password']}
          style={style}
          texture="none"
          locale="es"
          onSignup={callback}
        />,
      )
      expect(host.querySelectorAll('form')).toHaveLength(1)
      const email = host.querySelector<HTMLInputElement>('input[type="email"]')!
      expect(email.required).toBe(true)
      expect(host.querySelector(`label[for="${email.id}"]`)?.textContent).toContain('Correo')
      await enter(email, 'member@example.test')
      await submit()
      expect(request).toHaveBeenCalledTimes(1)
      expect(JSON.parse(String(request.mock.calls[0][1]!.body))).toEqual({
        email: 'member@example.test',
        purpose,
      })
      const verify = push.mock.calls[0][0] as string
      expect(verify).toContain(
        `/members/verify-otp?email=member%40example.test&purpose=${purpose === 'signup' ? 'signup' : 'password-reset'}&context=${context}&retryAfter=60&redirect=%2Faccount`,
      )
      expect(callback).not.toHaveBeenCalled()
      expect(complete).not.toHaveBeenCalled()
      await act(async () => root.unmount())
      host.remove()

      request.mockImplementation(async () =>
        Response.json({ success: true, permit: 'ownership-proof', expiresAt: Date.now() + 900000 }),
      )
      const otpNavigation = await mount(
        <AuthPages slug={['verify-otp']} style={style} texture="none" />,
        {},
        verify.split('?')[1],
      )
      await enter(host.querySelector('input')!, '123456')
      expect(JSON.parse(String(request.mock.calls[1][1]!.body))).toEqual({
        email: 'member@example.test',
        purpose,
        otp: '123456',
        context,
      })
      expect(otpNavigation.push).toHaveBeenCalledExactlyOnceWith(
        '/members/set-password?redirect=%2Faccount',
      )
      expect(otpNavigation.complete).not.toHaveBeenCalled()
      await act(async () => root.unmount())
      host.remove()

      request.mockImplementation(async () => Response.json({ success: true }))
      const passwordNavigation = await mount(
        <AuthPages slug={['set-password']} style={style} texture="none" />,
      )
      const passwords = host.querySelectorAll<HTMLInputElement>('input')
      expect(passwords).toHaveLength(2)
      await enter(passwords[0], strongPassword)
      await enter(passwords[1], strongPassword)
      await submit()
      expect(request.mock.calls[2][0]).toBe(
        `/api/auth/${purpose === 'signup' ? 'signup' : 'reset-password'}`,
      )
      expect(JSON.parse(String(request.mock.calls[2][1]!.body))).toEqual({
        permit: 'ownership-proof',
        password: strongPassword,
      })
      expect(passwordNavigation.push).toHaveBeenCalledExactlyOnceWith(
        '/members/login?redirect=%2Faccount',
      )
      expect(passwordNavigation.complete).not.toHaveBeenCalled()
      await act(async () => root.unmount())
      host.remove()
    }
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'keeps localized errors, proof-expired help and retryable ownership in %s pages',
  async (style) => {
    const request = vi.fn(async () =>
      Response.json({ success: false, code: 'AUTH_UNAVAILABLE' }, { status: 503 }),
    )
    vi.stubGlobal('fetch', request)
    await mount(
      <SignupPage style={style} locale="es" texture="none" onSignup={async () => {}} />,
      {},
      'reason=proof-expired&redirect=%2Faccount',
    )
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
    await enter(host.querySelector('input')!, 'member@example.test')
    await submit()
    const email = host.querySelector('input')!
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(email.getAttribute('aria-describedby')!)?.textContent).toBe(
      host.querySelector('[role="alert"]')?.textContent,
    )
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false)
    await act(async () => root.unmount())
    host.remove()
    await mount(<ForgotPasswordPage style={style} locale="es" texture="none" />)
    await enter(host.querySelector('input')!, 'member@example.test')
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/members/login?redirect=%2Faccount')
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'preserves password validation, visibility and voluntary reauthentication destination in %s',
  async (style) => {
    storePasswordProof(config, {
      purpose: 'reauth',
      permit: 'reauth-proof',
      expiresAt: Date.now() + 900000,
    })
    const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ success: true }),
    )
    vi.stubGlobal('fetch', request)
    const { complete, push } = await mount(
      <SetPasswordPage style={style} texture="none" locale="en" />,
    )
    const passwords = host.querySelectorAll<HTMLInputElement>('input')
    for (const password of passwords)
      expect(
        style === 'hero-ui'
          ? password
              .closest('[data-slot="input-group"]')
              ?.classList.contains('input-group--secondary')
          : password.classList.contains('bg-gray-100'),
      ).toBe(true)
    await enter(passwords[0], strongPassword)
    await enter(passwords[1], 'mismatch')
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('match')
    expect(request).not.toHaveBeenCalled()
    await enter(passwords[0], 'weak')
    await enter(passwords[1], 'weak')
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
    const showPassword = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Show password"]',
    )!
    const eye = showPassword.querySelector('svg')!
    expect(showPassword.textContent).toBe('')
    expect(eye.getAttribute('aria-hidden')).toBe('true')
    expect(eye.getAttribute('focusable')).toBe('false')
    expect(eye.getAttribute('stroke')).toBe('currentColor')
    expect(eye.getAttribute('width')).toBe('20')
    expect(eye.getAttribute('height')).toBe('20')
    expect(eye.querySelector('circle')).not.toBeNull()
    await act(async () => showPassword.click())
    expect(passwords[0].type).toBe('text')
    expect(passwords[1].type).toBe('text')
    const hidePassword = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Hide password"]',
    )!
    const eyeOff = hidePassword.querySelector('svg')!
    expect(hidePassword.textContent).toBe('')
    expect(eyeOff.getAttribute('aria-hidden')).toBe('true')
    expect(eyeOff.getAttribute('focusable')).toBe('false')
    expect(eyeOff.querySelector('path[d="m2 2 20 20"]')).not.toBeNull()
    await act(async () => hidePassword.click())
    expect(passwords[0].type).toBe('password')
    expect(passwords[1].type).toBe('password')
    await enter(passwords[0], strongPassword)
    await enter(passwords[1], strongPassword)
    await submit()
    expect(request.mock.calls[0][0]).toBe('/api/auth/set-password')
    expect(complete).toHaveBeenCalledExactlyOnceWith('/account')
    expect(push).not.toHaveBeenCalled()
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'keeps password and OTP reauthentication context and method visibility in %s',
  async (style) => {
    const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ success: true, permit: 'reauth-proof', expiresAt: Date.now() + 900000 }),
    )
    vi.stubGlobal('fetch', request)
    await mount(<AuthPages slug={['set-password']} style={style} texture="none" locale="en" />)
    expect(host.textContent).not.toContain('Verify by email')
    await enter(host.querySelector('input')!, 'current-password')
    await act(async () =>
      [...host.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Reauthenticate')!
        .click(),
    )
    expect(JSON.parse(String(request.mock.calls[0][1]!.body))).toEqual({
      password: 'current-password',
    })
    expect(host.querySelectorAll('input')).toHaveLength(2)
    await act(async () => root.unmount())
    host.remove()
    sessionStorage.clear()
    request.mockImplementation(async (url) =>
      String(url).endsWith('/me')
        ? Response.json({ user: { email: 'member@example.test' } })
        : Response.json({ success: true, context, retryAfter: 60 }),
    )
    const { push, complete } = await mount(
      <AuthPages slug={['set-password']} style={style} texture="none" locale="en" />,
      { otpLogin: true },
    )
    await act(async () =>
      [...host.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Verify by email')!
        .click(),
    )
    expect(push).toHaveBeenCalledExactlyOnceWith(
      `/members/verify-otp?email=member%40example.test&purpose=reauth&context=${context}&retryAfter=60&redirect=%2Faccount`,
    )
    expect(complete).not.toHaveBeenCalled()
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'limits signup, recovery and Google actions to configured methods in %s',
  async (style) => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    for (const slug of ['signup', 'forgot-password']) {
      await mount(
        <AuthPages slug={[slug]} style={style} texture="none" locale="en" showGoogleOAuth />,
        { allowSignup: false, recovery: false, googleOAuthEnabled: false },
      )
      expect(host.textContent).toContain('Continue')
      expect(host.textContent).not.toContain('Create Account')
      expect(host.textContent).not.toContain('Send Reset Code')
      expect(host.textContent).not.toContain('Google')
      await act(async () => root.unmount())
      host.remove()
    }
    await mount(
      <AuthPages slug={['signup']} style={style} texture="none" showGoogleOAuth={false} />,
      { googleOAuthEnabled: true },
    )
    expect(host.textContent).not.toContain('Google')
    expect(request).not.toHaveBeenCalled()
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'disables the single submit action while ownership or password completion is pending in %s',
  async (style) => {
    for (const slug of ['signup', 'forgot-password', 'set-password']) {
      if (slug === 'set-password')
        storePasswordProof(config, {
          purpose: 'recovery',
          permit: 'proof',
          expiresAt: Date.now() + 900000,
        })
      let resolve!: (response: Response) => void
      const request = vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      )
      vi.stubGlobal('fetch', request)
      const { complete } = await mount(<AuthPages slug={[slug]} style={style} texture="none" />)
      for (const input of host.querySelectorAll<HTMLInputElement>('input'))
        await enter(input, slug === 'set-password' ? strongPassword : 'member@example.test')
      await submit()
      expect(host.querySelectorAll('form')).toHaveLength(1)
      expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)
      expect(request).toHaveBeenCalledTimes(1)
      await act(async () =>
        resolve(Response.json({ success: false, code: 'AUTH_UNAVAILABLE' }, { status: 503 })),
      )
      expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
      expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false)
      expect(complete).not.toHaveBeenCalled()
      await act(async () => root.unmount())
      host.remove()
      sessionStorage.clear()
    }
  },
)

it.each([
  ['tailwind', 'dispatcher'],
  ['hero-ui', 'dispatcher'],
  ['tailwind', 'standalone'],
  ['hero-ui', 'standalone'],
] as const)(
  'uses one centered password heading and login-styled reauthentication help in %s %s',
  async (style, page) => {
    await mount(
      page === 'dispatcher' ? (
        <AuthPages slug={['set-password']} style={style} texture="none" locale="es" />
      ) : (
        <SetPasswordPage style={style} texture="none" locale="es" />
      ),
      { otpLogin: true },
    )
    expect(host.querySelectorAll('h1, h2')).toHaveLength(1)
    expect(host.querySelector('h1')?.classList.contains('text-center')).toBe(true)
    const intro = [...host.querySelectorAll('p')].find((paragraph) =>
      paragraph.textContent?.includes('Verifica tu identidad'),
    )!
    expect(intro.classList.contains('text-center')).toBe(true)
    expect(intro.classList.contains('text-sm')).toBe(true)
    expect(intro.classList.contains(style === 'hero-ui' ? 'text-muted' : 'text-gray-600')).toBe(
      true,
    )
    const back = host.querySelector<HTMLAnchorElement>('a[href^="/members/login"]')!
    expect(back.parentElement?.classList.contains('text-center')).toBe(true)
    expect(back.classList.contains('text-sm')).toBe(true)
    expect(back.classList.contains(style === 'hero-ui' ? 'text-muted' : 'text-gray-600')).toBe(true)
    expect(back.getAttribute('href')).toBe('/members/login?redirect=%2Faccount')
    const currentPassword = host.querySelector('input[autocomplete="current-password"]')!
    expect(
      style === 'hero-ui'
        ? currentPassword
            .closest('[data-slot="input-group"]')
            ?.classList.contains('input-group--secondary')
        : currentPassword.classList.contains('bg-gray-100'),
    ).toBe(true)
    const emailAction = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Verificar por correo'),
    )!
    expect(
      emailAction.classList.contains(style === 'hero-ui' ? 'button--secondary' : 'bg-gray-100'),
    ).toBe(true)
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'validates email inline and gates submit across auth email forms in %s',
  async (style) => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    for (const slug of ['login', 'signup', 'forgot-password']) {
      await mount(<AuthPages slug={[slug]} style={style} texture="none" locale="es" />)
      const input = host.querySelector<HTMLInputElement>('input[type="email"]')!
      const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!
      expect(button.disabled).toBe(true)
      expect(input.getAttribute('aria-invalid')).toBe('false')
      await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
      expect(input.getAttribute('aria-invalid')).toBe('true')
      await enter(input, 'no-es-correo')
      expect(input.getAttribute('aria-invalid')).toBe('true')
      const error = document.getElementById(input.getAttribute('aria-describedby')!)!
      expect(error.textContent).toContain('correo')
      expect(error.classList.contains('sr-only')).toBe(false)
      if (style === 'tailwind') expect(input.className).toContain('border-red-500')
      else {
        expect(input.getAttribute('style')).toBeNull()
        expect(error.getAttribute('data-slot')).toBe('field-error')
      }
      expect(button.disabled).toBe(true)
      await submit()
      expect(request).not.toHaveBeenCalled()
      expect(host.querySelector('input[type="email"]')).not.toBeNull()
      await enter(input, 'member@example.test')
      expect(input.getAttribute('aria-invalid')).toBe('false')
      expect(button.disabled).toBe(false)
      await act(async () => root.unmount())
      host.remove()
    }
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'gates password establishment and marks only invalid password fields in %s',
  async (style) => {
    storePasswordProof(config, {
      purpose: 'signup',
      permit: 'proof',
      expiresAt: Date.now() + 900000,
    })
    await mount(<SetPasswordPage style={style} texture="none" locale="en" />)
    const [password, confirmation] = host.querySelectorAll<HTMLInputElement>('input')
    const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(button.disabled).toBe(true)
    await enter(password, 'weak')
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(button.disabled).toBe(true)
    await enter(password, strongPassword)
    await enter(confirmation, 'different')
    expect(password.getAttribute('aria-invalid')).toBe('false')
    expect(confirmation.getAttribute('aria-invalid')).toBe('true')
    expect(button.disabled).toBe(true)
    await enter(confirmation, strongPassword)
    expect(confirmation.getAttribute('aria-invalid')).toBe('false')
    expect(button.disabled).toBe(false)
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'uses identical Google button presentation for signup and login in %s',
  async (style) => {
    const presentations: string[] = []
    for (const slug of ['login', 'signup']) {
      await mount(<AuthPages slug={[slug]} style={style} texture="none" />, {
        googleOAuthEnabled: true,
      })
      const button = [...host.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('Google'),
      )!
      presentations.push(button.className)
      await act(async () => root.unmount())
      host.remove()
    }
    expect(presentations[0]).toBe(presentations[1])
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'requires an existing password for login and reauthentication without imposing new-password strength in %s',
  async (style) => {
    const request = vi.fn(async () =>
      Response.json({ success: false, code: 'AUTH_FAILED' }, { status: 401 }),
    )
    vi.stubGlobal('fetch', request)
    await mount(<AuthPages slug={['login']} style={style} texture="none" locale="en" />)
    await enter(host.querySelector('input')!, 'member@example.test')
    await submit()
    const password = host.querySelector<HTMLInputElement>('input[type="password"]')!
    const submitButton = host.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(submitButton.disabled).toBe(true)
    await submit()
    expect(request).not.toHaveBeenCalled()
    await enter(password, 'old')
    expect(submitButton.disabled).toBe(false)
    await enter(password, 'x'.repeat(1025))
    expect(submitButton.disabled).toBe(true)
    await act(async () => root.unmount())
    host.remove()
    await mount(<SetPasswordPage style={style} texture="none" locale="en" />)
    const reauth = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Reauthenticate',
    )!
    expect(reauth.disabled).toBe(true)
    await enter(host.querySelector('input')!, 'old')
    expect(reauth.disabled).toBe(false)
    await act(async () => reauth.click())
    expect(request).toHaveBeenCalledTimes(1)
    const input = host.querySelector('input')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    if (style === 'tailwind') expect(input.style.borderColor).toBe('#ef4444')
    else {
      expect(input.getAttribute('style')).toBeNull()
      expect(host.querySelector('[data-invalid="true"]')).not.toBeNull()
    }
    await enter(input, 'corrected')
    expect(input.getAttribute('aria-invalid')).toBe('false')
  },
)

import { isAuthEmailValid } from '../src/authentication/interface/react/formValidation'
import { ownershipSendSchema } from '../src/authentication/interface/http/authSchemas'

it.each([
  '',
  'not-email',
  'user@domain',
  'user@@example.test',
  'user name@example.test',
  'member@example.test',
  '  member@example.test  ',
  `${'x'.repeat(242)}@example.test`,
  `${'x'.repeat(243)}@example.test`,
])('keeps client email admission aligned with HTTP ownership admission: %j', (email) => {
  expect(isAuthEmailValid(email)).toBe(
    ownershipSendSchema.safeParse({ email, purpose: 'signup' }).success,
  )
})
