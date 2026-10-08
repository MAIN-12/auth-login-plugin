import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService } from '../src/auth/interface/client/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('validates native session users and preserves public host fields', async () => {
  const fetch = vi.fn(async () => Response.json({ user: { id: 9, role: 'reader' } }))
  vi.stubGlobal('fetch', fetch)
  const service = createAuthService(publicConfig, 'es')
  expect(await service.session()).toEqual({ id: 9, role: 'reader' })
  expect(fetch).toHaveBeenCalledWith(
    '/api/users/me',
    expect.objectContaining({ cache: 'no-store', credentials: 'include' }),
  )
  fetch.mockResolvedValueOnce(Response.json({ user: { role: 'admin' } }))
  await expect(service.session()).rejects.toThrow('Unable to load the current session')
  fetch.mockResolvedValueOnce(new Response('invalid', { status: 401 }))
  expect(await service.session()).toBeNull()
  fetch.mockResolvedValueOnce(Response.json({ user: null }))
  expect(await service.session()).toBeNull()
})

it('shares one in-flight native session/logout request and allows retry after rejection', async () => {
  let resolve!: (value: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r
      }),
  )
  vi.stubGlobal('fetch', fetch)
  const service = createAuthService(publicConfig)
  const first = service.session()
  expect(service.session()).toBe(first)
  resolve(Response.json({ user: null }))
  expect(await first).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
  const logout = service.logout()
  expect(service.logout()).toBe(logout)
  resolve(new Response(null, { status: 503 }))
  await expect(logout).rejects.toThrow('Logout failed')
  const retry = service.logout()
  resolve(Response.json({ message: 'native logout' }))
  await retry
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    '/api/users/me',
    '/api/users/logout',
    '/api/users/logout',
  ])
})
