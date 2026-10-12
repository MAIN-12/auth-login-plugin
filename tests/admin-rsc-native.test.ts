import { expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { SignJWT } from 'jose'
import { createSessionPolicy } from '../src/collections/ConfiguredAuthCollection/infrastructure/payload/sessionPolicy'
import {
  createAdminPolicy,
  getAuthenticationEvidence,
} from '../src/collections/ConfiguredAuthCollection/infrastructure/payload/adminPolicy'
// Pinned Payload RSC initializer; only external Next context / database boundaries are mocked.
import { initReq } from '../node_modules/@payloadcms/next/dist/utilities/initReq.js'
import { JWTAuthentication } from '../node_modules/payload/dist/auth/strategies/jwt.js'

const boundary = vi.hoisted(() => ({ payload: null as unknown as Payload, headers: new Headers() }))
vi.mock('@payloadcms/ui/rsc', () => ({ upsertPreferences: vi.fn() }))
vi.mock('@payloadcms/ui/shared', () => ({ findLocaleFromCode: vi.fn() }))
vi.mock('next/headers.js', () => ({ headers: async () => boundary.headers }))
vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  getPayload: async () => boundary.payload,
}))
vi.mock('payload/internal', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  applyUserReadAccess: async ({ user }: { user: unknown }) => user,
}))

it.each(['password', 'otp', 'google'] as const)(
  'permits native Admin RSC authentication without an initial req (%s)',
  async (method) => {
    const now = Math.floor(Date.now() / 1000)
    const user = {
      id: 1,
      _verified: true,
      role: 'superadmin',
      sessions: [
        { id: 'sid', createdAt: new Date(now * 1000), expiresAt: new Date((now + 600) * 1000) },
      ],
    }
    const policy = createAdminPolicy(
      { authorize: ({ req }) => req.user?.role === 'superadmin', collections: [] },
      () => true,
    )
    const collection = {
      slug: 'users',
      auth: { depth: 0, useSessions: true, verify: true },
      access: { admin: ({ req }: { req: PayloadRequest }) => policy.permits(req) },
    }
    const config = {
      admin: { user: 'users' },
      collections: [],
      globals: [],
      auth: { jwtOrder: ['Bearer'] },
      csrf: [],
      cookiePrefix: 'payload',
      i18n: {
        fallbackLanguage: 'en',
        supportedLanguages: { en: { translations: {} } },
        translations: {},
      },
      localization: false,
    }
    boundary.payload = {
      config,
      secret: 'rsc-test-secret'.repeat(3),
      collections: { users: { config: collection } },
      findByID: async () => structuredClone(user),
      authStrategies: [{ name: 'local-jwt', authenticate: JWTAuthentication }],
      logger: { error: vi.fn() },
    } as unknown as Payload
    createSessionPolicy('users', 600).installStrategy(boundary.payload)
    const token = await new SignJWT({
      id: 1,
      collection: 'users',
      sid: 'sid',
      authLoginMethod: method,
    })
      .setProtectedHeader({ alg: 'HS256', authVersion: 1 })
      .setExpirationTime(now + 600)
      .sign(new TextEncoder().encode(boundary.payload.secret))
    boundary.headers = new Headers({ authorization: `Bearer ${token}` })
    const result = await initReq({
      configPromise: Promise.resolve(config) as never,
      importMap: {},
      key: `admin-${method}`,
    })
    expect(result.req.user?._sid).toBe('sid')
    expect(result.permissions.canAccessAdmin).toBe(true)
    expect(getAuthenticationEvidence(result.req)?.method).toBe(method)
    expect(await policy.permits(result.req)).toBe(true)
    expect(
      await policy.permits({ ...result.req, user: { ...result.req.user } } as PayloadRequest),
    ).toBe(false)
    expect(await policy.permits({ ...result.req, headers: new Headers(boundary.headers) })).toBe(
      false,
    )
    expect(await policy.permits({ ...result.req, user: null })).toBe(false)
    const sid = result.req.user!._sid
    result.req.user!._sid = 'substituted-session'
    expect(await policy.permits(result.req)).toBe(false)
    result.req.user!._sid = sid
    boundary.headers = new Headers({ authorization: `Bearer ${token.slice(0, -8)}invalid!` })
    const rejected = await initReq({
      configPromise: Promise.resolve(config) as never,
      importMap: {},
      key: `invalid-${method}`,
    })
    expect(rejected.req.user).toBeNull()
    expect(rejected.permissions.canAccessAdmin).toBeFalsy()
    expect(getAuthenticationEvidence(rejected.req)).toBeUndefined()
  },
)
