import { afterEach, expect, it, vi } from 'vitest'
import { generatePayloadCookie, loginOperation } from 'payload'
import { verifyOtpEndpoint, setPasswordEndpoint } from '../src/endpoints/authEndpoints'
import { hashOtp } from '../src/auth/domain/otp'

vi.mock('payload', async (importOriginal) => ({
  ...await importOriginal<typeof import('payload')>(),
  loginOperation: vi.fn(),
}))
afterEach(() => vi.restoreAllMocks())

function request(authOverrides = {}) {
  const auth = { cookies: { sameSite: 'None', domain: 'example.com', secure: true }, tokenExpiration: 3600, useSessions: true, ...authOverrides }
  return {
    json: async () => ({ email: ' User@Example.com ', otp: '123456' }),
    headers: new Headers(),
    payload: {
      config: { cookiePrefix: 'custom', cors: [] },
      collections: { users: { config: { slug: 'users', auth } } },
      find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 'otp', hash: hashOtp('123456'), expiresAt: new Date(Date.now() + 60000).toISOString() }] }).mockResolvedValueOnce({ docs: [{ id: 'user', hasPassword: true }] }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  } as any
}

it.each([true, false])('uses native cookie configuration and forwards the request with sessions=%s', async (useSessions) => {
  vi.useFakeTimers()
  try {
    const req = request({ useSessions })
    vi.mocked(loginOperation).mockResolvedValue({ user: { id: 'user' } as any, token: 'signed-token' })
    const result = await verifyOtpEndpoint.handler(req)
    expect(result.status).toBe(200)
    expect(loginOperation).toHaveBeenCalledWith(expect.objectContaining({ req, collection: req.payload.collections.users, data: { email: 'user@example.com', password: expect.any(String) } }))
    expect(result.headers.get('set-cookie')).toBe(generatePayloadCookie({ collectionAuthConfig: req.payload.collections.users.config.auth, cookiePrefix: 'custom', token: 'signed-token' }))
    expect(await result.json()).toMatchObject({ success: true, token: 'signed-token' })
  } finally { vi.useRealTimers() }
})

it('keeps the cookie while suppressing tokens in JSON when configured', async () => {
  const req = request({ removeTokenFromResponses: true })
  vi.mocked(loginOperation).mockResolvedValue({ user: { id: 'user' } as any, token: 'signed-token' })
  const result = await verifyOtpEndpoint.handler(req)
  expect(result.headers.get('set-cookie')).toContain('custom-token=signed-token')
  expect(await result.json()).not.toHaveProperty('token')
})

it('forwards the current session when setting a password', async () => {
  const req = request()
  req.user = { id: 'user', collection: 'users', _sid: 'current-session' }
  req.json = async () => ({ password: 'long-password', confirmPassword: 'long-password' })
  expect((await setPasswordEndpoint.handler(req)).status).toBe(200)
  expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ req, id: 'user', collection: 'users' }))
})

it('rejects a user from a different auth collection', async () => {
  const req = request()
  req.user = { id: 'user', collection: 'admins' }
  req.json = async () => ({ password: 'long-password', confirmPassword: 'long-password' })
  expect((await setPasswordEndpoint.handler(req)).status).toBe(401)
  expect(req.payload.update).not.toHaveBeenCalled()
})
