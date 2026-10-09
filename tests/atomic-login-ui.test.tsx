// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthCard, AuthPages, AuthConfigProvider } from '../src/exports/client'
import { AuthFlowContext } from '../src/auth/interface/react/AuthFlowContext'
import { publicConfig } from './auth-test-config'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let host: HTMLDivElement

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  vi.unstubAllGlobals()
})

async function mount(node: React.ReactNode, complete = vi.fn(async (_target: string) => {})) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () =>
    root.render(
      <AuthConfigProvider
        publicConfig={{
          ...publicConfig,
          authBasePath: '/members',
          recovery: true,
          allowSignup: true,
        }}
      >
        <AuthFlowContext.Provider
          value={{
            push: vi.fn(),
            complete,
            searchParams: new URLSearchParams('redirect=%2Faccount'),
          }}
        >
          {node}
        </AuthFlowContext.Provider>
      </AuthConfigProvider>,
    ),
  )
  await vi.waitFor(
    async () => {
      await act(async () => {})
      expect(host.querySelector('form')).toBeTruthy()
    },
    { timeout: 5000 },
  )
  return complete
}
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

it.each(['tailwind', 'hero-ui'] as const)(
  'completes one password login through public pages with %s controls',
  async (style) => {
    const login = vi.fn(async (_credentials: { email: string; password: string }) => {})
    const complete = await mount(
      <AuthPages
        slug={['login']}
        style={style}
        texture="none"
        locale="es"
        onPasswordLogin={login}
      />,
    )
    expect(host.querySelectorAll('form')).toHaveLength(1)
    const email = host.querySelector<HTMLInputElement>('input[type="email"]')!
    expect(host.querySelector(`label[for="${email.id}"]`)?.textContent).toContain('Correo')
    expect(email.required).toBe(true)
    expect(host.querySelector('a[href*="signup"]')?.getAttribute('href')).toBe(
      '/members/signup?redirect=%2Faccount',
    )
    await enter(email, 'member@example.test')
    await submit()
    const password = host.querySelector<HTMLInputElement>('input[type="password"]')!
    expect(host.querySelector(`label[for="${password.id}"]`)?.textContent).toContain('Contraseña')
    expect(host.querySelector('a[href*="forgot-password"]')?.getAttribute('href')).toBe(
      '/members/forgot-password?redirect=%2Faccount',
    )
    await enter(password, 'existing-password')
    await submit()
    expect(login).toHaveBeenCalledExactlyOnceWith({
      email: 'member@example.test',
      password: 'existing-password',
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith('/account')
  },
)

it.each(['tailwind', 'hero-ui'] as const)(
  'announces retryable password failure and prevents concurrent submits with %s controls',
  async (style) => {
    let reject!: (reason: Error) => void
    const login = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail
        }),
    )
    const complete = await mount(
      <AuthCard
        slug="login"
        style={style}
        locale="en"
        onPasswordLogin={login}
        mobileVariant="card"
      />,
    )
    await enter(host.querySelector('input')!, 'member@example.test')
    await submit()
    await enter(host.querySelector('input[type="password"]')!, 'wrong-password')
    await submit()
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)
    await submit()
    expect(login).toHaveBeenCalledTimes(1)
    await act(async () => reject(new Error('failure')))
    const password = host.querySelector<HTMLInputElement>('input[type="password"]')!
    expect(password.getAttribute('aria-invalid')).toBe('true')
    const description = document.getElementById(password.getAttribute('aria-describedby')!)!
    expect(description.textContent).toBeTruthy()
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(description.textContent)
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false)
    expect(complete).not.toHaveBeenCalled()
  },
)

import { FormField } from '../src/components/molecules/FormField'
it.each(['tailwind', 'hero-ui'] as const)(
  'associates a custom card field label, help and error in %s',
  async (style) => {
    await mount(
      <AuthCard style={style} logo={null} poweredBy={{ enabled: false }}>
        <form>
          <FormField
            id="contact-email"
            label="Contact email"
            help="Use your account address"
            error="Try again"
            value="member@example.test"
            onValueChange={() => {}}
          />
        </form>
      </AuthCard>,
    )
    const input = host.querySelector('input')!
    expect(host.querySelector('label')?.htmlFor).toBe(input.id)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const descriptions = input
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
    expect(descriptions).toContain('Use your account address')
    expect(descriptions).toContain('Try again')
  },
)
