import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService } from '../src/auth/application/services/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('explicit Google linking submits only a confirmed permit and navigates the server-issued authorization URL', async () => {
  const assign = vi.fn()
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ url: 'https://accounts.google.com/authorize' }))
  vi.stubGlobal('window', { location: { assign } })
  vi.stubGlobal('fetch', fetch)
  await createAuthService({ ...publicConfig, googleOAuthEnabled: true }).linkGoogle(
    'limited-permit',
    '/profile#methods',
  )
  expect(fetch.mock.calls[0][0]).toBe('/api/auth/oauth/google/link')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    permit: 'limited-permit',
    confirm: true,
    returnTo: '/profile#methods',
  })
  expect(assign).toHaveBeenCalledWith('https://accounts.google.com/authorize')
})
it('Google reauthentication receives a bounded popup grant only from the exact popup and origin', async () => {
  const close = vi.fn()
  const popup = { closed: false, close }
  const listeners = new Map<string, (event: MessageEvent) => void>()
  const open = vi.fn(() => popup)
  vi.stubGlobal('window', {
    location: { origin: 'https://app.example' },
    open,
    addEventListener: (name: string, listener: (event: MessageEvent) => void) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  })
  let settled = false
  const result = createAuthService({
    ...publicConfig,
    googleOAuthEnabled: true,
  }).reauthenticateGoogle()
  result.then(() => {
    settled = true
  })
  const data = {
    type: 'auth-login.google.reauthentication',
    grant: { success: true, permit: 'limited', expiresAt: Date.now() + 300000 },
  }
  listeners.get('message')!({
    origin: 'https://attacker.example',
    source: popup,
    data,
  } as unknown as MessageEvent)
  listeners.get('message')!({ origin: 'https://app.example', source: {}, data } as MessageEvent)
  await Promise.resolve()
  expect(settled).toBe(false)
  listeners.get('message')!({
    origin: 'https://app.example',
    source: popup,
    data,
  } as unknown as MessageEvent)
  expect(await result).toMatchObject({ purpose: 'reauth', permit: 'limited' })
  expect(open.mock.calls[0][0]).toBe('/api/auth/oauth/google/reauthenticate?mode=popup')
  expect(close).toHaveBeenCalled()
  expect(listeners.size).toBe(0)
})
it('one service admits only one Google popup while reauthentication is in flight', async () => {
  const popup = { closed: false, close: vi.fn() }
  const listeners = new Map<string, (event: MessageEvent) => void>()
  const open = vi.fn(() => popup)
  vi.stubGlobal('window', {
    location: { origin: 'https://app.test' },
    open,
    addEventListener: (name: string, listener: (event: MessageEvent) => void) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  })
  const service = createAuthService({ ...publicConfig, googleOAuthEnabled: true })
  const first = service.reauthenticateGoogle()
  const second = service.reauthenticateGoogle()
  const denied = expect(second).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' })
  listeners.get('message')!({
    origin: 'https://app.test',
    source: popup,
    data: {
      type: 'auth-login.google.reauthentication',
      grant: { success: true, permit: 'bounded', expiresAt: Date.now() + 60000 },
    },
  } as unknown as MessageEvent)
  await first
  await denied
  expect(open).toHaveBeenCalledTimes(1)
})
it('expired popup proof closes and removes listeners, then permits a fresh retry without transport', async () => {
  const popup = { closed: false, close: vi.fn() }
  const listeners = new Map<string, (event: MessageEvent) => void>()
  vi.stubGlobal('window', {
    location: { origin: 'https://app.test' },
    open: vi.fn(() => popup),
    addEventListener: (name: string, listener: (event: MessageEvent) => void) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  })
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const service = createAuthService({ ...publicConfig, googleOAuthEnabled: true })
  const send = (data: unknown) =>
    listeners.get('message')!({
      origin: 'https://app.test',
      source: popup,
      data,
    } as unknown as MessageEvent)
  const first = service.reauthenticateGoogle()
  const denied = expect(first).rejects.toMatchObject({ code: 'AUTH_FAILED' })
  send({
    type: 'auth-login.google.reauthentication',
    grant: { success: true, permit: 'expired', expiresAt: Date.now() - 1 },
  })
  await denied
  expect(listeners.size).toBe(0)
  const retry = service.reauthenticateGoogle()
  send({
    type: 'auth-login.google.reauthentication',
    grant: { success: true, permit: 'bad', expiresAt: 'malformed' },
  })
  expect(listeners.size).toBe(1)
  send({
    type: 'auth-login.google.reauthentication',
    grant: { success: true, permit: 'fresh', expiresAt: Date.now() + 60000 },
  })
  expect(await retry).toMatchObject({ purpose: 'reauth', permit: 'fresh' })
  expect(fetch).not.toHaveBeenCalled()
})
it('Google linking has one HTTP request while in flight and allows retry after a transient failure', async () => {
  const assign = vi.fn()
  vi.stubGlobal('window', { location: { assign } })
  let reject!: (error: Error) => void
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    .mockResolvedValueOnce(Response.json({ url: 'https://accounts.google.com/authorize' }))
  vi.stubGlobal('fetch', fetch)
  const service = createAuthService({ ...publicConfig, googleOAuthEnabled: true })
  const first = service.linkGoogle('limited')
  const failure = expect(first).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' })
  await expect(service.linkGoogle('limited')).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' })
  reject(new Error('network'))
  await failure
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(assign).not.toHaveBeenCalled()
  await service.linkGoogle('limited')
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(assign).toHaveBeenCalledTimes(1)
})
