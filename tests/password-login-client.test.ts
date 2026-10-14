import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService } from '../src/authentication/interface/client/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('uses configured routes and locale per instance and captures caller configuration', async () => {
  const fetch = vi.fn(async () => Response.json({ success: true }))
  vi.stubGlobal('fetch', fetch)
  const config = { ...publicConfig, apiPrefix: '/backend', authEndpointPrefix: '/access' }
  const first = createAuthService(config, 'es')
  config.apiPrefix = '/mutated'
  await first.login({ email: 'a@b.test', password: 'x' })
  await createAuthService({ ...publicConfig, apiPrefix: '/other' }, 'en').login({
    email: 'b@b.test',
    password: 'y',
  })
  expect(fetch.mock.calls[0]).toEqual([
    '/backend/access/login',
    expect.objectContaining({
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'es' },
    }),
  ])
  expect(fetch.mock.calls[1][0]).toBe('/other/auth/login')
})
it('disabled client login has no transport effects', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await expect(
    createAuthService({ ...publicConfig, passwordLogin: false }).login({
      email: 'a@b.test',
      password: 'x',
    }),
  ).rejects.toMatchObject({ code: 'METHOD_DISABLED', status: 403 })
  expect(fetch).not.toHaveBeenCalled()
})
it.each([{}, { success: 'true' }])('denies malformed login success: %j', async (data) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(data)),
  )
  await expect(
    createAuthService(publicConfig).login({ email: 'a@b.test', password: 'x' }),
  ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 })
})
it.each(['SESSION_LOGIN_DENIED', 'private provider secret'])(
  'client preserves known safe reasons and ignores unrecognized text: %s',
  async (reason) => {
    const requestId = '6511e40a-61f2-4efe-953b-326979b0cc36'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ success: false, code: 'AUTH_FAILED', reason, requestId }, { status: 401 }),
      ),
    )
    await expect(
      createAuthService(publicConfig).login({ email: 'a@b.test', password: 'x' }),
    ).rejects.toMatchObject({
      code: 'AUTH_FAILED',
      status: 401,
      reason: reason === 'SESSION_LOGIN_DENIED' ? reason : undefined,
      requestId,
    })
  },
)
