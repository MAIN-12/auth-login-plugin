import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin } from '../src/index'
let dir: string
let payload: Payload
let config: Awaited<ReturnType<typeof buildConfig>>
const key = 'password-http-test'
let html = ''
let failChange = false
let publicAdminEligible = false
let publicAdminDefaults = false
let hidePublicRole = false
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), key))
  config = await buildConfig({
    secret: 'shared-lifecycle-secret-32-characters',
    db: sqliteAdapter({ client: { url: `file:${dir}/test.db` } }),
    telemetry: false,
    email: () => ({
      name: 'test',
      defaultFromAddress: 'auth@example.com',
      defaultFromName: 'Test',
      sendEmail: async (mail) => {
        html = String(mail.html)
      },
    }),
    collections: [
      {
        slug: 'customers',
        auth: { useSessions: true, verify: true, removeTokenFromResponses: true },
        access: { admin: ({ req }) => publicAdminEligible || req.user?.role === 'admin' },
        fields: [
          {
            name: 'role',
            type: 'text',
            defaultValue: () => (publicAdminDefaults ? 'admin' : 'customer'),
          },
        ],
        hooks: {
          afterRead: [
            ({ doc }) => {
              if (hidePublicRole) delete doc.role
              return doc
            },
          ],
          beforeChange: [
            ({ data }) => {
              if (failChange) throw new Error('fixture failure')
              return data
            },
          ],
        },
      },
    ],
    plugins: [
      authLoginPlugin({
        collection: 'customers',
        passwordLogin: true,
        otpLogin: false,
        providers: { google: false },
        allowSignup: true,
        recovery: true,
        otp: {
          secret: 'dedicated-lifecycle-secret-32-characters',
          origin: () => 'trusted-peer',
          email: { from: 'auth@example.com', locale: 'en' },
        },
      }),
    ],
  })
  payload = await getPayload({ config, key })
})
afterAll(async () => {
  await payload?.destroy()
  if (dir) await rm(dir, { recursive: true, force: true })
})
const request = (path: string, body?: unknown, cookie?: string) =>
  handleEndpoints({
    config,
    payloadInstanceCacheKey: key,
    request: new Request(`http://localhost:3000/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  })
async function verify(email: string, purpose: string) {
  const sentResponse = await request('/auth/otp/send', { email, purpose })
  expect(sentResponse.status).toBe(200)
  const sent = await sentResponse.json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  const response = await request('/auth/otp/verify', { email, purpose, context: sent.context, otp })
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  return response.json()
}
it('real native signup commits an owner-chosen credential once after email proof, without session', async () => {
  const grant = await verify('owner@example.com', 'signup')
  const response = await request('/auth/signup', {
    permit: grant.permit,
    password: 'the river carries quiet dreams',
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  expect(
    (
      await request('/auth/signup', {
        permit: grant.permit,
        password: 'another owner chosen phrase',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request('/auth/login', {
        email: 'owner@example.com',
        password: 'the river carries quiet dreams',
      })
    ).status,
  ).toBe(200)
}, 20000)
it('native hook failure rolls back reset credential, sessions and single-use consumption', async () => {
  const login = await request('/auth/login', {
    email: 'owner@example.com',
    password: 'the river carries quiet dreams',
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const grant = await verify('owner@example.com', 'recovery')
  failChange = true
  expect(
    (
      await request('/auth/reset-password', {
        permit: grant.permit,
        password: 'a different owner chosen phrase',
      })
    ).status,
  ).toBe(401)
  failChange = false
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeTruthy()
  expect(
    (
      await request('/auth/reset-password', {
        permit: grant.permit,
        password: 'a different owner chosen phrase',
      })
    ).status,
  ).toBe(200)
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeNull()
  expect(
    (
      await request('/auth/reset-password', {
        permit: grant.permit,
        password: 'yet another owner chosen phrase',
      })
    ).status,
  ).toBe(401)
})
it('native password reauthentication never adds a session and change rotates within its original absolute cap', async () => {
  const login = await request('/auth/login', {
    email: 'owner@example.com',
    password: 'a different owner chosen phrase',
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const old = await payload.db.findOne<NonNullable<import('payload').PayloadRequest['user']>>({
    collection: 'customers',
    where: { email: { equals: 'owner@example.com' } },
  })
  expect(old!.sessions).toHaveLength(1)
  const response = await request(
    '/auth/reauthenticate',
    { password: 'a different owner chosen phrase' },
    cookie,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  const unchanged = await payload.db.findOne<NonNullable<import('payload').PayloadRequest['user']>>(
    { collection: 'customers', where: { id: { equals: old!.id } } },
  )
  expect(unchanged!.sessions).toEqual(old!.sessions)
  const grant = await response.json()
  const changed = await request(
    '/auth/set-password',
    { permit: grant.permit, password: 'one more owner chosen phrase' },
    cookie,
  )
  expect(changed.status).toBe(200)
  const currentCookie = changed.headers.get('set-cookie')!.split(';')[0]
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeNull()
  expect(
    (await (await request('/customers/me', undefined, currentCookie)).json()).user,
  ).toBeTruthy()
  const current = await payload.db.findOne<NonNullable<import('payload').PayloadRequest['user']>>({
    collection: 'customers',
    where: { id: { equals: old!.id } },
  })
  expect((current!.sessions as Array<{ createdAt: string }>)[0].createdAt).toEqual(
    (old!.sessions as Array<{ createdAt: string }>)[0].createdAt,
  )
})
it('strict ownership HTTP schemas reject extra authority fields, unknown purposes and wrong scalar types', async () => {
  for (const [path, body] of [
    ['/auth/otp/send', { email: 'schema@example.com', purpose: 'signup', role: 'admin' }],
    ['/auth/otp/send', { email: 'schema@example.com', purpose: 'not-a-purpose' }],
    [
      '/auth/otp/verify',
      { email: 'schema@example.com', purpose: 'recovery', context: 'a'.repeat(64), otp: 123456 },
    ],
    ['/auth/forgot-password', { email: 'schema@example.com', password: 'must not be reserved' }],
    ['/auth/reauthenticate', { password: 123 }],
    [
      '/auth/signup',
      {
        permit: 'opaque',
        password: 'the river carries quiet dreams',
        email: 'retarget@example.com',
      },
    ],
  ] as const) {
    const response = await request(path, body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, code: 'INVALID_INPUT' })
  }
})

it('public native signup cannot hide original consumer Admin eligibility behind the plugin deny policy', async () => {
  const grant = await verify('admin-default@example.com', 'signup')
  publicAdminEligible = true
  try {
    expect(
      (
        await request('/auth/signup', {
          permit: grant.permit,
          password: 'a safe public owner phrase',
        })
      ).status,
    ).toBe(401)
  } finally {
    publicAdminEligible = false
  }
  expect(
    (
      await request('/auth/login', {
        email: 'admin-default@example.com',
        password: 'a safe public owner phrase',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request('/auth/signup', {
        permit: grant.permit,
        password: 'a safe public owner phrase',
      })
    ).status,
  ).toBe(200)
})

it('public native provisioning checks stored Admin eligibility even when afterRead hides the role', async () => {
  const grant = await verify('hidden-admin-default@example.com', 'signup')
  publicAdminDefaults = true
  hidePublicRole = true
  try {
    expect(
      (
        await request('/auth/signup', {
          permit: grant.permit,
          password: 'safe owner phrase for signup',
        })
      ).status,
    ).toBe(401)
  } finally {
    publicAdminDefaults = false
    hidePublicRole = false
  }
  expect(
    (
      await request('/auth/login', {
        email: 'hidden-admin-default@example.com',
        password: 'safe owner phrase for signup',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request('/auth/signup', {
        permit: grant.permit,
        password: 'safe owner phrase for signup',
      })
    ).status,
  ).toBe(200)
})

it('temporary password failure diagnostics contain only the fixed stage and existing correlation', async () => {
  const info = vi.spyOn(payload.logger, 'info')
  const diagnostic = () =>
    info.mock.calls
      .map(([entry]) => entry as unknown as Record<string, unknown>)
      .filter(
        (entry) => entry?.event === '[DEBUG-password-authority] auth.password-completion.failed',
      )
  try {
    const malformed = await request('/auth/reset-password', {
      permit: 'fixture-opaque-invalid-permit',
      password: 'fixture owner selected password phrase',
    })
    expect(malformed.status).toBe(401)
    expect(await malformed.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
    expect(diagnostic()).toEqual([
      {
        event: '[DEBUG-password-authority] auth.password-completion.failed',
        correlation: malformed.headers.get('X-Auth-Request-ID'),
        stage: 'permit-read',
      },
    ])
    const signup = await verify('diagnostic-owner@example.test', 'signup')
    expect(
      (
        await request('/auth/signup', {
          permit: signup.permit,
          password: 'fixture original owner password phrase',
        })
      ).status,
    ).toBe(200)
    const recovery = await verify('diagnostic-owner@example.test', 'recovery')
    failChange = true
    const hookFailure = await request('/auth/reset-password', {
      permit: recovery.permit,
      password: 'fixture replacement owner password phrase',
    })
    failChange = false
    expect(hookFailure.status).toBe(401)
    expect(await hookFailure.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
    expect(diagnostic()[1]).toEqual({
      event: '[DEBUG-password-authority] auth.password-completion.failed',
      correlation: hookFailure.headers.get('X-Auth-Request-ID'),
      stage: 'native-password-write',
    })
    expect(
      (
        await request('/auth/reset-password', {
          permit: recovery.permit,
          password: 'fixture replacement owner password phrase',
        })
      ).status,
    ).toBe(200)
    expect(diagnostic()).toHaveLength(2)
    for (const entry of diagnostic()) {
      expect(Object.keys(entry).sort()).toEqual(['correlation', 'event', 'stage'])
      expect(entry.correlation).toMatch(/^[a-f0-9-]{36}$/)
    }
  } finally {
    failChange = false
    info.mockRestore()
  }
})

it('temporary set-password diagnostics report admission without exposing submitted credentials', async () => {
  const info = vi.spyOn(payload.logger, 'info')
  try {
    const response = await request('/auth/set-password', {
      permit: 'fixture-opaque-reauth-permit',
      password: 'fixture replacement owner password phrase',
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ success: false, code: 'METHOD_DISABLED' })
    expect(info).toHaveBeenCalledWith({
      event: '[DEBUG-password-authority] auth.password-completion.failed',
      correlation: response.headers.get('X-Auth-Request-ID'),
      stage: 'admission',
    })
  } finally {
    info.mockRestore()
  }
})

it('temporary diagnostic logger failures never replace the existing password rejection', async () => {
  const info = vi.spyOn(payload.logger, 'info').mockImplementation(() => {
    throw new Error('fixture unavailable logger')
  })
  try {
    const response = await request('/auth/reset-password', {
      permit: 'fixture-opaque-invalid-permit',
      password: 'fixture owner selected password phrase',
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
    expect(response.headers.get('X-Auth-Request-ID')).toMatch(/^[a-f0-9-]{36}$/)
  } finally {
    info.mockRestore()
  }
})
