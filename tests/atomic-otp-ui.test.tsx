// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthCard, AuthPages, AuthConfigProvider, VerifyOtpPage } from '../src/exports/client'
import { AuthFlowContext } from '../src/auth/interface/react/AuthFlowContext'
import { publicConfig } from './auth-test-config'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let host: HTMLDivElement
const context = 'a'.repeat(64)
const params = `email=member%40example.test&context=${context}&redirect=%2Faccount`
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})
async function mount(node: React.ReactNode, query = params) {
  const push = vi.fn()
  const complete = vi.fn(async () => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () =>
    root.render(
      <AuthConfigProvider
        publicConfig={{
          ...publicConfig,
          authBasePath: '/members',
          otpLogin: true,
          passwordLogin: false,
          recovery: true,
          allowSignup: true,
        }}
      >
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
      expect(host.querySelector('input, [role="alert"]')).toBeTruthy()
    },
    { timeout: 5000 },
  )
  return { push, complete }
}
async function enter(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function paste(value: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => value } })
  await act(async () => host.querySelector('input')!.dispatchEvent(event))
}
function pendingRequest() {
  let resolve!: (response: Response) => void
  const request = vi.fn(
    (_url: string | URL | Request, _init?: RequestInit) =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', request)
  return { request, finish: async (body: unknown) => act(async () => resolve(Response.json(body))) }
}

it.each(['tailwind', 'hero-ui'] as const)(
  'coordinates automatic/manual verification, resend and retry in public %s pages',
  async (style) => {
    const { request, finish } = pendingRequest()
    const { complete } = await mount(
      <AuthPages slug={['verify-otp']} style={style} locale="es" texture="none" />,
    )
    expect(host.querySelectorAll('[role="group"]')).toHaveLength(1)
    await paste('123456')
    const buttons = host.querySelectorAll<HTMLButtonElement>('button')
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input')].every((input) => input.disabled),
    ).toBe(true)
    expect(buttons[1].disabled).toBe(true)
    await act(async () => {
      buttons[0].click()
      buttons[1].click()
    })
    expect(request).toHaveBeenCalledTimes(1)
    await finish({ success: false })
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input')].map((input) => input.value),
    ).toEqual(['', '', '', '', '', ''])
    expect(buttons[1].disabled).toBe(false)
    await enter(host.querySelector('input')!, '654321')
    expect(request).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(request.mock.calls[1][1]!.body))).toEqual({
      email: 'member@example.test',
      purpose: 'login',
      otp: '654321',
      context,
    })
    await finish({ success: true, user: { id: 'A' }, exp: Math.floor(Date.now() / 1000) + 900 })
    expect(complete).toHaveBeenCalledExactlyOnceWith('/account')
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'preserves positions, keyboard focus and paste through a public %s card',
  async (style) => {
    const { request, finish } = pendingRequest()
    await mount(<AuthCard slug="verify-otp" style={style} locale="en" />)
    await paste('12345')
    const inputs = host.querySelectorAll<HTMLInputElement>('input')
    expect(document.activeElement).toBe(inputs[5])
    await enter(inputs[2], '')
    expect([...inputs].map((input) => input.value)).toEqual(['1', '2', '', '4', '5', ''])
    await enter(inputs[2], '9')
    expect(document.activeElement).toBe(inputs[3])
    await act(async () =>
      inputs[3].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
      ),
    )
    expect([...inputs].map((input) => input.value)).toEqual(['1', '2', '9', '', '5', ''])
    await act(async () =>
      inputs[3].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
      ),
    )
    expect(document.activeElement).toBe(inputs[2])
    expect([...inputs].map((input) => input.value)).toEqual(['1', '2', '', '', '5', ''])
    await act(async () =>
      inputs[2].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      ),
    )
    expect(document.activeElement).toBe(inputs[1])
    await act(async () =>
      inputs[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      ),
    )
    expect(document.activeElement).toBe(inputs[2])
    expect(request).not.toHaveBeenCalled()
    await paste('654-321')
    expect(request).toHaveBeenCalledTimes(1)
    await finish({ success: true, user: { id: 'A' }, exp: Math.floor(Date.now() / 1000) + 900 })
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'excludes verification while resending and announces resend failures in %s',
  async (style) => {
    const { request, finish } = pendingRequest()
    await mount(<AuthCard slug="verify-otp" style={style} locale="es" />)
    await act(async () => host.querySelectorAll<HTMLButtonElement>('button')[1].click())
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input')].every((input) => input.disabled),
    ).toBe(true)
    expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true)
    await act(async () => host.querySelectorAll<HTMLButtonElement>('button')[1].click())
    expect(request).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(request.mock.calls[0][1]!.body))).toEqual({
      email: 'member@example.test',
      purpose: 'login',
      context,
    })
    await finish({ success: false })
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
    expect(host.querySelector<HTMLInputElement>('input')!.disabled).toBe(false)
    await act(async () => host.querySelectorAll<HTMLButtonElement>('button')[1].click())
    await finish({ success: true, context, retryAfter: 60 })
    expect(host.textContent).toContain('60')
    expect(host.querySelectorAll<HTMLButtonElement>('button')[1].disabled).toBe(true)
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'offers localized recovery for invalid OTP links in a single %s page',
  async (style) => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    await mount(
      <VerifyOtpPage style={style} locale="es" texture="none" />,
      `email=member%40example.test&context=invalid&purpose=signup&redirect=%2Faccount`,
    )
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(host.textContent).toContain('Volver')
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      '/members/signup?redirect=%2Faccount',
    )
    expect(host.querySelector('input')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  },
)

it.each([
  ['login', 'login', undefined],
  ['signup', 'signup', '/members/set-password?redirect=%2Faccount'],
  ['password-reset', 'recovery', '/members/set-password?redirect=%2Faccount'],
  ['reauth', 'reauth', '/members/set-password?redirect=%2Faccount'],
  ['verify-email', 'verify-email', '/members/login?redirect=%2Faccount'],
] as const)(
  'keeps %s verification and continuation separate from other purposes',
  async (purpose, sentPurpose, destination) => {
    const request = vi.fn(async () =>
      Response.json(
        purpose === 'login'
          ? { success: true, user: { id: 'A' }, exp: Math.floor(Date.now() / 1000) + 900 }
          : purpose === 'verify-email'
            ? { success: true }
            : { success: true, permit: 'ownership-proof', expiresAt: Date.now() + 900000 },
      ),
    )
    vi.stubGlobal('fetch', request)
    const { push, complete } = await mount(
      <AuthPages slug={['verify-otp']} texture="none" />,
      `${params}&purpose=${purpose}`,
    )
    await enter(host.querySelector('input')!, '123456')
    const [, init] = request.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'member@example.test',
      otp: '123456',
      context,
      purpose: sentPurpose,
    })
    if (destination) {
      expect(push).toHaveBeenCalledExactlyOnceWith(destination)
      expect(complete).not.toHaveBeenCalled()
    } else {
      expect(complete).toHaveBeenCalledExactlyOnceWith('/account')
      expect(push).not.toHaveBeenCalled()
    }
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'requests a login OTP once, announces failure and retries with %s',
  async (style) => {
    const { request, finish } = pendingRequest()
    const password = vi.fn(async () => {})
    const { push } = await mount(
      <AuthPages
        slug={['login']}
        style={style}
        locale="es"
        texture="none"
        onPasswordLogin={password}
      />,
      'redirect=%2Faccount',
    )
    await enter(host.querySelector('input')!, 'member@example.test')
    await act(async () =>
      host
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    )
    expect(host.querySelector('input[type="password"]')).toBeNull()
    const send = [...host.querySelectorAll<HTMLButtonElement>('button')].at(-1)!
    await act(async () => {
      send.click()
      send.click()
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(send.disabled).toBe(true)
    await finish({ success: false })
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
    await act(async () => send.click())
    expect(request).toHaveBeenCalledTimes(2)
    await finish({ success: true, context, retryAfter: 60 })
    expect(push).toHaveBeenCalledExactlyOnceWith(
      `/members/verify-otp?email=member%40example.test&context=${context}&retryAfter=60&redirect=%2Faccount`,
    )
    expect(password).not.toHaveBeenCalled()
  },
)
