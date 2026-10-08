import { afterEach, expect, it, vi } from 'vitest'
import { createAuthService } from '../src/auth/interface/client/authService'
import { publicConfig } from './auth-test-config'
afterEach(() => vi.unstubAllGlobals())
it('the shared client rejects expired ownership permits instead of storing an unusable continuation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ success: true, permit: 'opaque', expiresAt: Date.now() - 1 }),
    ),
  )
  await expect(
    createAuthService(publicConfig).verifyOwnership(
      'owner@example.com',
      'signup',
      '123456',
      'a'.repeat(64),
    ),
  ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' })
})
