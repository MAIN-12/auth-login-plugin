import { expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { otpEndpoints } from '../src/auth/interface/http/otpLogin'
import { publicConfig } from './auth-test-config'
import type { OtpOptions } from '../src/config'
import type { createOtpLoginScope } from '../src/auth/composition/otpLogin'
const settings = { ...publicConfig, otpLogin: true }
const options: OtpOptions = { secret: 'private-key'.repeat(4), origin: () => 'trusted-peer' }
function request(input: unknown) {
  const r = new Request('https://host.test/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return Object.assign(r, {
    payload: {
      config: { csrf: [], cors: [], cookiePrefix: 'native' },
      collections: {
        [settings.collection]: {
          config: { auth: { tokenExpiration: 3600, cookies: {}, removeTokenFromResponses: true } },
        },
      },
      logger: { info: vi.fn() },
    },
  }) as unknown as PayloadRequest
}
function fixture() {
  const send = vi.fn(async () => ({
    ok: true as const,
    value: {
      success: true as const,
      code: 'OTP_REQUEST_ACCEPTED' as const,
      context: 'a'.repeat(64),
      retryAfter: 60,
    },
  }))
  const verify = vi.fn(async () => ({
    ok: true as const,
    value: { accountID: 'A', collection: settings.collection },
  }))
  const takeReceipt = vi.fn(() => ({
    token: 'private-native-token',
    exp: Math.floor(Date.now() / 1000) + 900,
    user: { id: 'A' },
  }))
  const dispose = vi.fn()
  const factory = vi.fn(
    () =>
      ({ send, verify, takeReceipt, dispose }) as unknown as ReturnType<typeof createOtpLoginScope>,
  )
  const endpoints = otpEndpoints(settings, options, factory, () => {
    throw new Error('unexpected ownership')
  })
  return { send, verify, takeReceipt, dispose, factory, endpoints }
}
it('HTTP send maps generic accepted with CORS/no-store without a session or receipt', async () => {
  const f = fixture()
  const req = request({ email: 'user@example.com', purpose: 'login' })
  const response = (await f.endpoints[0].handler(req)) as Response
  expect(await response.json()).toEqual({
    success: true,
    code: 'OTP_REQUEST_ACCEPTED',
    context: 'a'.repeat(64),
    retryAfter: 60,
  })
  expect(f.factory).toHaveBeenCalledWith(req)
  expect(f.send).toHaveBeenCalledWith(
    { email: 'user@example.com', purpose: 'login' },
    'trusted-peer',
  )
  expect(f.takeReceipt).not.toHaveBeenCalled()
  expect(f.verify).not.toHaveBeenCalled()
  expect(f.dispose).toHaveBeenCalledTimes(1)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Set-Cookie')).toBeNull()
})
it('HTTP verify materializes only its private native receipt and cookie lifetime', async () => {
  const f = fixture()
  const response = (await f.endpoints[1].handler(
    request({
      email: 'user@example.com',
      purpose: 'login',
      context: 'a'.repeat(64),
      otp: '123456',
    }),
  )) as Response
  expect(await response.json()).toEqual({
    success: true,
    user: { id: 'A' },
    exp: expect.any(Number),
  })
  expect(response.headers.get('Set-Cookie')).toContain('native-token=private-native-token')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(f.dispose).toHaveBeenCalledTimes(1)
})
it('HTTP async rejection clears scope and filters exception/body secrets', async () => {
  const f = fixture()
  f.verify.mockRejectedValueOnce(new Error('private db/email/code'))
  const response = (await f.endpoints[1].handler(
    request({
      email: 'user@example.com',
      purpose: 'login',
      context: 'a'.repeat(64),
      otp: '123456',
    }),
  )) as Response
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ success: false, code: 'AUTH_UNAVAILABLE' })
  expect(response.headers.get('X-Auth-Request-ID')).toBeTruthy()
  expect(f.dispose).toHaveBeenCalledTimes(1)
  expect(f.takeReceipt).not.toHaveBeenCalled()
})
