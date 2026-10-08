// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { publicConfig } from './auth-test-config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthProvider,
  useAuth,
  type AuthContextValue,
  type AuthProviderProps,
} from '../src/components/AuthProvider'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams('email=unrelated@example.com&redirect=/wrong'),
}))

let root: Root
let host: HTMLDivElement
let auth: AuthContextValue
let authenticated: boolean
let fetchMock: ReturnType<typeof vi.fn>
const user = { id: 42, email: 'member@example.com' }
function Probe() {
  auth = useAuth()
  return <p>Current page content</p>
}
async function mount(props: Partial<AuthProviderProps> = {}) {
  await act(async () =>
    root.render(
      <AuthProvider
        publicConfig={publicConfig}
        modalLogin
        initialUser={null}
        authCardProps={{ showGoogleOAuth: false, locale: 'en' }}
        {...props}
      >
        <Probe />
      </AuthProvider>,
    ),
  )
}
async function open() {
  await act(async () => auth.openLogin())
}
async function fill(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector)!
  expect(input).toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function submit() {
  await act(async () => {
    document
      .querySelector('dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}
async function click(selector: string) {
  await act(async () => {
    document.querySelector<HTMLElement>(selector)!.click()
  })
}
async function enterEmail() {
  await fill('dialog input[type=email]', user.email)
  await submit()
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.clearAllMocks()
  authenticated = false
  window.history.replaceState({}, '', '/products?category=books#details')
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  // happy-dom does not implement the browser's native dialog top layer.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/me')) return Response.json({ user: authenticated ? user : null })
    if (url === '/api/auth/login' || url === '/api/auth/otp/verify') authenticated = true
    if (url === '/api/users/logout') authenticated = false
    if (url === '/api/auth/check-email') return Response.json({ exists: true, hasPassword: true })
    return Response.json({ success: true, isNewUser: false })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('session guard', () => {
  it('validates the server session before allowing a protected action', async () => {
    authenticated = true
    await mount()
    let result = false
    await act(async () => {
      result = await auth.isLoggedIn()
    })
    expect(result).toBe(true)
    expect(auth.user).toEqual(user)
    expect(auth.status).toBe('authenticated')
    expect(auth.isLoginOpen).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me', {
      credentials: 'include',
      cache: 'no-store',
    })
  })
  it('opens the modal for an expired session, including the isLogedin alias', async () => {
    await mount({ initialUser: user })
    await act(async () => {
      expect(await auth.isLogedin()).toBe(false)
    })
    expect(auth.status).toBe('unauthenticated')
    expect(auth.isLoginOpen).toBe(true)
    expect(router.push).not.toHaveBeenCalled()
  })
  it('navigates to the configured login page when modal mode is disabled', async () => {
    await mount({ modalLogin: false, basePath: '/account' })
    await act(async () => {
      expect(await auth.isLoggedIn()).toBe(false)
    })
    expect(router.push).toHaveBeenCalledWith(
      '/account/login?redirect=%2Fproducts%3Fcategory%3Dbooks%23details',
    )
  })
  it('does not treat a network failure as a confirmed logout', async () => {
    await mount({ initialUser: user })
    fetchMock.mockRejectedValueOnce(new Error('Offline'))
    await act(async () => {
      await expect(auth.isLoggedIn()).rejects.toThrow('Offline')
    })
    expect(auth.user).toEqual(user)
    expect(auth.status).toBe('error')
    expect(auth.isLoginOpen).toBe(false)
  })
  it('loads an omitted initial session and clears it after logout', async () => {
    authenticated = true
    await mount({ initialUser: undefined })
    expect(auth.user).toEqual(user)
    await act(async () => auth.logout())
    expect(auth.user).toBeNull()
    expect(auth.status).toBe('unauthenticated')
    expect(router.refresh).toHaveBeenCalled()
  })
  it('rejects stale session checks after logout', async () => {
    await mount({ initialUser: user })
    let resolve!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r
        }),
    )
    const pending = auth.isLoggedIn()
    const rejection = expect(pending).rejects.toThrow('superseded')
    await act(async () => auth.logout())
    await act(async () => {
      resolve(Response.json({ user }))
      await rejection
    })
    expect(auth.user).toBeNull()
  })
})

describe('modal authentication flow', () => {
  it('renders and dismisses the real HeroUI v3 modal', async () => {
    await import('../src/components/AuthModalHero')
    await mount({ style: 'hero-ui' })
    await open()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    expect(document.querySelector('[data-slot="modal-dialog"]')).toBeTruthy()
    expect(
      document
        .querySelector('[data-slot="modal-dialog"] input[type=email]')
        ?.classList.contains('input'),
    ).toBe(true)
    expect(
      document
        .querySelector('[data-slot="modal-dialog"] button[type=submit]')
        ?.classList.contains('button'),
    ).toBe(true)
    await click('[data-slot="modal-close-trigger"]')
    expect(auth.isLoginOpen).toBe(false)
  })
  it.each(['modal-backdrop', 'modal-container'])(
    'dismisses clicks on the empty %s but not the form',
    async (slot) => {
      await import('../src/components/AuthModalHero')
      await mount({ style: 'hero-ui' })
      await open()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
      })
      await click('[data-slot="modal-dialog"] input[type=email]')
      expect(auth.isLoginOpen).toBe(true)
      await click(`[data-slot="${slot}"]`)
      expect(auth.isLoginOpen).toBe(false)
      expect(auth.status).toBe('unauthenticated')
      expect(router.push).not.toHaveBeenCalled()
    },
  )
  it('completes password login on the current page and ignores unrelated page query parameters', async () => {
    await mount()
    await open()
    await enterEmail()
    await fill('dialog input[type=password]', 'Correct-password-123!')
    await submit()
    expect(auth.status).toBe('authenticated')
    expect(document.querySelector('dialog')).toBeNull()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/products?category=books#details',
    )
    expect(router.push).not.toHaveBeenCalled()
    expect(router.refresh).toHaveBeenCalled()
  })
  it('honors an explicit local destination after successful login', async () => {
    await mount()
    await act(async () => auth.openLogin({ redirectTo: '/checkout?step=2' }))
    await enterEmail()
    await fill('dialog input[type=password]', 'Correct-password-123!')
    await submit()
    expect(router.push).toHaveBeenCalledWith('/checkout?step=2')
  })
  it('does not offer the disabled signup, recovery, Google or OTP paths', async () => {
    await mount()
    await open()
    await enterEmail()
    expect(document.querySelector('dialog a[href*="signup"]')).toBeNull()
    expect(document.querySelector('dialog a[href*="forgot-password"]')).toBeNull()
    expect(document.querySelector('dialog input[type=password]')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/check-email', expect.anything())
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/otp/send', expect.anything())
  })
  it('resets form state after dismissal and restores scroll', async () => {
    await mount()
    await open()
    await enterEmail()
    expect(document.body.style.overflow).toBe('hidden')
    await click('dialog button[aria-label="Close"]')
    expect(document.body.style.overflow).toBe('')
    await open()
    expect(document.querySelector<HTMLInputElement>('dialog input[type=email]')!.value).toBe('')
  })
  it('does not close a newly opened modal when an older request completes', async () => {
    await mount()
    await open()
    await enterEmail()
    let resolve!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r
        }),
    )
    await fill('dialog input[type=password]', 'Correct-password-123!')
    await submit()
    await act(async () => auth.closeLogin())
    await open()
    authenticated = true
    await act(async () => {
      resolve(Response.json({ success: true }))
    })
    expect(auth.isLoginOpen).toBe(true)
  })
})

describe('public method selection', () => {
  it('advances unknown and existing email identities identically without a public lookup', async () => {
    await mount()
    await open()
    await fill('dialog input[type=email]', 'unknown@example.com')
    await submit()
    expect(document.querySelector('dialog input[type=password]')).toBeTruthy()
    expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain('/api/auth/check-email')
  })
})
describe('server and UI instance isolation', () => {
  it('keeps collection paths and branding separate across sibling tree render order', async () => {
    const contexts: Record<string, AuthContextValue> = {}
    function InstanceProbe({ id }: { id: string }) {
      contexts[id] = useAuth()
      return <span>{id}</span>
    }
    const first = {
      ...publicConfig,
      collection: 'customers',
      apiPrefix: '/backend',
      logoUrl: '/first.svg',
    }
    const second = {
      ...publicConfig,
      collection: 'members',
      apiPrefix: '/other',
      logoUrl: '/second.svg',
    }
    const tree = (reverse: boolean) =>
      (reverse ? ['second', 'first'] : ['first', 'second']).map((id) => (
        <AuthProvider
          key={id}
          publicConfig={id === 'first' ? first : second}
          initialUser={null}
          modalLogin
        >
          <InstanceProbe id={id} />
        </AuthProvider>
      ))
    await act(async () => root.render(tree(false)))
    await act(async () => contexts.first.openLogin())
    expect(document.querySelector('dialog img')?.getAttribute('src')).toBe('/first.svg')
    await act(async () => contexts.first.closeLogin())
    await act(async () => contexts.second.openLogin())
    expect(document.querySelector('dialog img')?.getAttribute('src')).toBe('/second.svg')
    await act(async () => contexts.second.closeLogin())
    fetchMock.mockClear()
    await act(async () => root.render(tree(true)))
    await act(async () => {
      await contexts.first.refreshSession()
      await contexts.second.refreshSession()
    })
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/backend/customers/me',
      '/other/members/me',
    ])
  })
})

it('shares concurrent session checks and rejects malformed users without confirming authentication', async () => {
  await mount({ initialUser: user })
  let resolve!: (value: Response) => void
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((r) => {
        resolve = r
      }),
  )
  const first = auth.refreshSession()
  expect(auth.refreshSession()).toBe(first)
  await act(async () => {
    resolve(Response.json({ user: { role: 'admin' } }))
    await expect(first).rejects.toThrow('Unable to load')
  })
  expect(auth.user).toEqual(user)
  expect(auth.status).toBe('error')
  await act(async () => {
    expect(await auth.refreshSession()).toBeNull()
  })
  expect(auth.status).toBe('unauthenticated')
})
