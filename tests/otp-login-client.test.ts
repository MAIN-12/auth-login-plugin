import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService } from '../src/auth/interface/client/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('OTP send refuses malformed context before a form can navigate with it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ success: true, context: 'not-a-proof-context', retryAfter: 60 }),
    ),
  )
  await expect(
    createAuthService({ ...publicConfig, otpLogin: true }).sendOtp('user@example.com'),
  ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' })
})
it.each([{ success: true }, { success: true, user: { id: 'A' }, exp: 1 }])(
  'OTP verification rejects malformed or expired authority %j',
  async (response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(response)),
    )
    await expect(
      createAuthService({ ...publicConfig, otpLogin: true }).verifyOtp(
        'user@example.com',
        '123456',
        'a'.repeat(64),
      ),
    ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' })
  },
)
