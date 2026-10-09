import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { AuthenticationError } from 'payload'
import { createPasswordLoginScope } from '../src/auth/composition/passwordLogin'
import { passwordLoginEndpoint } from '../src/auth/interface/http/passwordLogin'
import { publicConfig } from './auth-test-config'

function request(body: unknown, removeToken = true, origin = 'https://app.test') {
  const http = new Request('https://app.test/backend/access/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  })
  return {
    headers: http.headers,
    body: http.body,
    payload: {
      config: { csrf: ['https://app.test'], cors: ['https://app.test'], cookiePrefix: 'host' },
      logger: { info: vi.fn() },
      collections: {
        [publicConfig.collection]: {
          config: { auth: { removeTokenFromResponses: removeToken, cookies: { sameSite: 'Lax' } } },
        },
      },
    },
  } as unknown as PayloadRequest
}
const credentials = { email: 'a@b.test', password: 'x' }
it.each([true, false])(
  'maps native cookie/user/expiry and token visibility (%s)',
  async (hidden) => {
    const req = request(credentials, hidden)
    const native = vi.fn(async () => ({
      user: { id: 1, _verified: true },
      token: 'native-secret',
      exp: Math.floor(Date.now() / 1000) + 30,
    }))
    const endpoint = passwordLoginEndpoint(publicConfig, (req) =>
      createPasswordLoginScope(publicConfig, req, native as never),
    )
    const response = await endpoint.handler(req)
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toMatch(/^host-token=native-secret;.*HttpOnly/)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test')
    const data = await response.json()
    expect(data).toMatchObject({
      success: true,
      user: { id: 1 },
      capabilities: { password: 'available', emailVerification: 'verified' },
    })
    expect(data.token).toBe(hidden ? undefined : 'native-secret')
    expect(native).toHaveBeenCalledTimes(1)
  },
)
it.each([
  [
    async () => {
      throw new AuthenticationError((key: string) => key as never)
    },
    401,
    'AUTH_FAILED',
  ],
  [
    async () => {
      throw new Error('private infrastructure stack/token')
    },
    503,
    'AUTH_UNAVAILABLE',
  ],
  [async () => ({}), 503, 'AUTH_UNAVAILABLE'],
] as const)('maps native failure safely with a correlation ID', async (native, status, code) => {
  const req = request(credentials)
  const response = await passwordLoginEndpoint(publicConfig, (req) =>
    createPasswordLoginScope(publicConfig, req, native as never),
  ).handler(req)
  expect(response.status).toBe(status)
  expect(await response.json()).toEqual({ success: false, code })
  expect(response.headers.get('Set-Cookie')).toBeNull()
  expect(response.headers.get('X-Auth-Request-ID')).toMatch(/^[a-f0-9-]{36}$/)
  expect(JSON.stringify(vi.mocked(req.payload.logger.info).mock.calls)).not.toMatch(
    /private|native-secret|a@b.test/,
  )
})
it('rejects origin and input before native effects', async () => {
  const native = vi.fn()
  const endpoint = passwordLoginEndpoint(publicConfig, (req) =>
    createPasswordLoginScope(publicConfig, req, native),
  )
  for (const [body, origin, status, code] of [
    [credentials, 'https://evil.test', 403, 'ORIGIN_DENIED'],
    [{ email: 2 }, 'https://app.test', 400, 'INVALID_INPUT'],
  ] as const) {
    const response = await endpoint.handler(request(body, true, origin))
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ success: false, code })
  }
  expect(native).not.toHaveBeenCalled()
})
