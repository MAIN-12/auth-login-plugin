import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService } from '../src/auth/application/services/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('explicit Google linking submits only a confirmed permit and navigates the server-issued authorization URL', async () => {
  const assign = vi.fn()
  const fetch = vi.fn().mockResolvedValue(Response.json({ url: 'https://accounts.google.com/authorize' }))
  vi.stubGlobal('window', { location: { assign } })
  vi.stubGlobal('fetch', fetch)
  await createAuthService({ ...publicConfig, googleOAuthEnabled: true }).linkGoogle('limited-permit', '/profile#methods')
  expect(fetch.mock.calls[0][0]).toBe('/api/auth/oauth/google/link')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ permit: 'limited-permit', confirm: true, returnTo: '/profile#methods' })
  expect(assign).toHaveBeenCalledWith('https://accounts.google.com/authorize')
})
it('Google reauthentication receives a bounded popup grant only from the exact popup and origin', async () => {
  const close = vi.fn()
  const popup = { closed: false, close }
  const listeners = new Map<string, (event: MessageEvent) => void>()
  const open = vi.fn(() => popup)
  vi.stubGlobal('window', { location: { origin: 'https://app.example' }, open, addEventListener: (name: string, listener: (event: MessageEvent) => void) => listeners.set(name, listener), removeEventListener: (name: string) => listeners.delete(name) })
  let settled = false
  const result = createAuthService({ ...publicConfig, googleOAuthEnabled: true }).reauthenticateGoogle()
  result.then(() => { settled = true })
  const data = { type: 'auth-login.google.reauthentication', grant: { success: true, permit: 'limited', expiresAt: Date.now() + 300000 } }
  listeners.get('message')!({ origin: 'https://attacker.example', source: popup, data } as unknown as MessageEvent)
  listeners.get('message')!({ origin: 'https://app.example', source: {}, data } as MessageEvent)
  await Promise.resolve()
  expect(settled).toBe(false)
  listeners.get('message')!({ origin: 'https://app.example', source: popup, data } as unknown as MessageEvent)
  expect(await result).toMatchObject({ purpose: 'reauth', permit: 'limited' })
  expect(open.mock.calls[0][0]).toBe('/api/auth/oauth/google/reauthenticate?mode=popup')
  expect(close).toHaveBeenCalled()
  expect(listeners.size).toBe(0)
})
