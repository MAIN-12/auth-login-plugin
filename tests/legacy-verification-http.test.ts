import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin } from '../src/index'
let dir: string
let payload: Payload
let secondPayload: Payload
let config: Awaited<ReturnType<typeof buildConfig>>
const key = 'legacy-verification-http-test'
let html = ''
let failChange = false
const publicAdminEligible = false
const publicAdminDefaults = false
const hidePublicRole = false
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
        access: {
          update: () => true,
          admin: ({ req }) => publicAdminEligible || req.user?.role === 'admin',
        },
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
              if (failChange) data.hash = 'malicious hook hash'
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
  secondPayload = await getPayload({ config, key: `${key}-second` })
})
afterAll(async () => {
  await secondPayload?.destroy()
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
it('legacy email proof preserves the original password and creates no session', async () => {
  await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'legacy@example.com', password: 'short', _verified: false },
    disableVerificationEmail: true,
  })
  const grant = await verify('legacy@example.com', 'verify-email')
  expect(grant).toEqual({ success: true })
  const record = await payload.find({
    collection: 'customers',
    overrideAccess: true,
    where: { email: { equals: 'legacy@example.com' } },
  })
  expect(record.docs[0]._verified).toBe(true)
  expect(record.docs[0].sessions ?? []).toEqual([])
  const login = await request('/auth/login', { email: 'legacy@example.com', password: 'short' })
  expect(login.status).toBe(200)
}, 20000)
it('email-only verification cannot unlock an administrative account', async () => {
  await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'adminlegacy@example.com', password: 'short', _verified: false, role: 'admin' },
    disableVerificationEmail: true,
  })
  const sent = await (
    await request('/auth/otp/send', { email: 'adminlegacy@example.com', purpose: 'verify-email' })
  ).json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  const response = await request('/auth/otp/verify', {
    email: 'adminlegacy@example.com',
    purpose: 'verify-email',
    context: sent.context,
    otp,
  })
  expect(response.status).toBe(401)
  expect(response.headers.get('set-cookie')).toBeNull()
  const record = await payload.find({
    collection: 'customers',
    overrideAccess: true,
    where: { email: { equals: 'adminlegacy@example.com' } },
  })
  expect(record.docs[0]._verified).toBe(false)
  expect(record.docs[0].sessions ?? []).toEqual([])
})
it('host hooks cannot replace credentials during verification and the consumed proof remains burnt', async () => {
  await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'hooklegacy@example.com', password: 'short', _verified: false },
    disableVerificationEmail: true,
  })
  const sent = await (
    await request('/auth/otp/send', { email: 'hooklegacy@example.com', purpose: 'verify-email' })
  ).json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  failChange = true
  const input = {
    email: 'hooklegacy@example.com',
    purpose: 'verify-email',
    context: sent.context,
    otp,
  }
  expect((await request('/auth/otp/verify', input)).status).toBe(401)
  failChange = false
  expect((await request('/auth/otp/verify', input)).status).toBe(401)
  const record = await payload.find({
    collection: 'customers',
    overrideAccess: true,
    where: { email: { equals: 'hooklegacy@example.com' } },
  })
  expect(record.docs[0]._verified).toBe(false)
  expect(record.docs[0].sessions ?? []).toEqual([])
})
it('HTTP cannot forge legacy verification evidence when host update access permits anonymous writes', async () => {
  const user = await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'spooflegacy@example.com', password: 'short', _verified: false },
    disableVerificationEmail: true,
  })
  const response = await handleEndpoints({
    config,
    payloadInstanceCacheKey: key,
    request: new Request(`http://localhost:3000/api/customers/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ _verified: true }),
    }),
  })
  expect(response.status).toBe(403)
})
it('two real instances consume legacy ownership once without creating a session', async () => {
  await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'racelegacy@example.com', password: 'short', _verified: false },
    disableVerificationEmail: true,
  })
  const sent = await (
    await request('/auth/otp/send', { email: 'racelegacy@example.com', purpose: 'verify-email' })
  ).json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  const input = {
    email: 'racelegacy@example.com',
    purpose: 'verify-email',
    context: sent.context,
    otp,
  }
  const results = await Promise.all([
    request('/auth/otp/verify', input),
    handleEndpoints({
      config,
      payloadInstanceCacheKey: `${key}-second`,
      request: new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    }),
  ])
  expect(results.map((result) => result.status).sort()).toEqual([200, 401])
  for (const result of results) expect(result.headers.get('set-cookie')).toBeNull()
  const records = await secondPayload.find({
    collection: 'customers',
    overrideAccess: true,
    where: { email: { equals: 'racelegacy@example.com' } },
  })
  expect(records.docs[0]._verified).toBe(true)
  expect(records.docs[0].sessions ?? []).toEqual([])
})
it('ownership verification does not enable disabled OTP login or create password permits', async () => {
  expect(
    (await request('/auth/otp/send', { email: 'legacy@example.com', purpose: 'login' })).status,
  ).toBe(403)
  expect(
    (
      await request('/auth/otp/verify', {
        email: 'legacy@example.com',
        purpose: 'login',
        context: 'a'.repeat(64),
        otp: '123456',
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await request('/auth/otp/verify', {
        email: 'legacy@example.com',
        purpose: 'recovery',
        context: 'a'.repeat(64),
        otp: '123456',
      })
    ).status,
  ).toBe(401)
})
it('native generation storage failure returns unavailable rather than an authentication denial', async () => {
  const db = payload.db as unknown as {
    drizzle: unknown
    execute: (args: { db: unknown; raw: string }) => Promise<unknown>
  }
  // A real SQLite missing relation, not an authentication/storage mock.
  await db.execute({
    db: db.drizzle,
    raw: 'ALTER TABLE auth_login_cutovers RENAME TO fixture_preserved_cutovers',
  })
  await db.execute({
    db: db.drizzle,
    raw: 'CREATE VIEW auth_login_cutovers AS SELECT generation FROM fixture_missing_storage',
  })
  try {
    const response = await request('/auth/otp/send', {
      email: 'legacy@example.com',
      purpose: 'verify-email',
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ success: false, code: 'AUTH_UNAVAILABLE' })
    expect(response.headers.get('set-cookie')).toBeNull()
  } finally {
    await db.execute({ db: db.drizzle, raw: 'DROP VIEW auth_login_cutovers' })
    await db.execute({
      db: db.drizzle,
      raw: 'ALTER TABLE fixture_preserved_cutovers RENAME TO auth_login_cutovers',
    })
  }
})
