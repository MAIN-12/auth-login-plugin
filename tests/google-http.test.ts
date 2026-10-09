import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { googleEndpoints } from '../src/auth/interface/http/google'
import type { createGoogleScope } from '../src/auth/composition/google'
import { AuthOperationFailure } from '../src/auth/domain/errors'
import { publicConfig } from './auth-test-config'
const redirectURI = 'https://app.test/api/auth/oauth/google/callback'
const state = 'a'.repeat(43)
function fixture() {
  const scope = {
    start: vi.fn(async () => ({ state, url: 'https://accounts.google.com/authorize' })),
    callback: vi.fn(),
    takeReceipt: vi.fn(),
    dispose: vi.fn(),
  }
  const settings = { ...publicConfig, googleOAuthEnabled: true }
  const endpoints = googleEndpoints(
    settings,
    redirectURI,
    true,
    () => scope as unknown as ReturnType<typeof createGoogleScope>,
  )
  const req = {
    url: `${redirectURI}?state=${state}&code=private-code`,
    headers: new Headers({
      host: 'app.test',
      cookie: `${settings.collection}-oauth-${state}=browser`,
    }),
    payload: {
      config: { cors: [], csrf: [] },
      logger: { info: vi.fn() },
      collections: {
        [settings.collection]: {
          config: { auth: { cookies: { secure: true, sameSite: 'Lax' }, tokenExpiration: 60 } },
        },
      },
    },
  } as unknown as PayloadRequest
  return { scope, req, endpoints, settings }
}
it('callback failure clears only correlation cookie and filters infrastructure text without a session receipt', async () => {
  const f = fixture()
  f.scope.callback.mockRejectedValueOnce(new Error('private provider secret'))
  const response = await f.endpoints.at(-1)!.handler(f.req)
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ success: false, code: 'AUTH_UNAVAILABLE' })
  expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0')
  expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; SameSite=Lax')
  expect(response.headers.get('Set-Cookie')).toContain('Secure')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(f.scope.takeReceipt).not.toHaveBeenCalled()
  expect(f.scope.dispose).toHaveBeenCalledTimes(1)
})
it('callback login creates native cookie only from its private receipt and never serializes tokens', async () => {
  const f = fixture()
  f.scope.callback.mockResolvedValueOnce({
    result: { success: true },
    purpose: 'login',
    returnTo: '/profile#methods',
  })
  f.scope.takeReceipt.mockReturnValueOnce({
    token: 'private-native-token',
    exp: Date.now() / 1000 + 60,
  })
  const response = await f.endpoints.at(-1)!.handler(f.req)
  expect(response.status).toBe(303)
  expect(response.headers.get('Location')).toBe('/profile#methods')
  expect(await response.text()).toBe('')
  expect(response.headers.get('Set-Cookie')).toContain('private-native-token')
  expect(f.scope.callback).toHaveBeenCalledWith(state, 'browser', f.req.url)
  expect(f.scope.dispose).toHaveBeenCalledTimes(1)
})
it('wrong callback host denies before application and preserves the historical pre-extraction cleanup phase', async () => {
  const f = fixture()
  f.req.headers.set('host', 'wrong.test')
  const response = await f.endpoints.at(-1)!.handler(f.req)
  expect(response.status).toBe(401)
  expect(response.headers.get('Set-Cookie')).toBeNull()
  expect(f.scope.callback).not.toHaveBeenCalled()
  expect(f.scope.dispose).toHaveBeenCalledTimes(1)
})
it('start method failures retain semantic mapping and dispose request scope without correlation cookies', async () => {
  const f = fixture()
  f.req.url = 'https://app.test/api/auth/oauth/google'
  f.req.headers.set('Origin', 'https://app.test')
  f.scope.start.mockRejectedValueOnce(new AuthOperationFailure('METHOD_DISABLED'))
  const response = await f.endpoints[0].handler(f.req)
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ success: false, code: 'METHOD_DISABLED' })
  expect(response.headers.get('Set-Cookie')).toBeNull()
  expect(f.scope.dispose).toHaveBeenCalledTimes(1)
})
