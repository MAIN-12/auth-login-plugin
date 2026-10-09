import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin, migrateAuthLogin } from '../src/index'
let dir: string
let payload: Payload
let secondPayload: Payload
let config: Awaited<ReturnType<typeof buildConfig>>
const key = 'migration-http-test'
let html = ''
let mailCount = 0
let clock = Date.now()
const failChange = false
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
        mailCount++
      },
    }),
    collections: [
      {
        slug: 'auth-otps',
        fields: [
          { name: 'scope', type: 'text' },
          { name: 'token', type: 'text' },
        ],
      },
      { slug: 'staff', auth: { useSessions: true, verify: true }, fields: [] },
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
          now: () => clock,
          cooldownSeconds: 1,
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
it('public maintenance cutover preserves accounts and passwords but revokes sessions and outstanding signup permits', async () => {
  await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'cutoff@example.com', password: 'short', _verified: true },
    disableVerificationEmail: true,
  })
  const login = await request('/auth/login', { email: 'cutoff@example.com', password: 'short' })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const grant = await verify('pending@example.com', 'signup')
  const result = await migrateAuthLogin(payload, { collection: 'customers', maintenance: true })
  expect(result.success).toBe(true)
  expect(result.accounts).toBe(1)
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeNull()
  expect(
    (
      await request('/auth/signup', {
        permit: grant.permit,
        password: 'a new owner selected password',
      })
    ).status,
  ).toBe(401)
  expect(
    (await request('/auth/login', { email: 'cutoff@example.com', password: 'short' })).status,
  ).toBe(200)
}, 20000)
it('cutover burns outstanding ownership challenges without rotating host keys', async () => {
  const sent = await (
    await request('/auth/otp/send', { email: 'cutoff@example.com', purpose: 'verify-email' })
  ).json()
  // Verified accounts do not receive ownership mail; recovery is the actual eligible outstanding challenge.
  expect(typeof sent.context).toBe('string')
  const recovery = await (
    await request('/auth/otp/send', { email: 'cutoff@example.com', purpose: 'recovery' })
  ).json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  await migrateAuthLogin(payload, { collection: 'customers', maintenance: true })
  expect(
    (
      await request('/auth/otp/verify', {
        email: 'cutoff@example.com',
        purpose: 'recovery',
        context: recovery.context,
        otp,
      })
    ).status,
  ).toBe(401)
})
it('cutover preserves account issuance budgets and each repeat chooses a fresh generation', async () => {
  await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'quota@example.com', password: 'short', _verified: false },
    disableVerificationEmail: true,
  })
  const start = mailCount
  for (let attempt = 0; attempt < 5; attempt++) {
    clock += 1001
    expect(
      (
        await request('/auth/otp/send', {
          email: 'quota@example.com',
          purpose: 'verify-email',
          context: 'a'.repeat(64),
        })
      ).status,
    ).toBe(200)
  }
  expect(mailCount - start).toBe(5)
  const first = await migrateAuthLogin(payload, { collection: 'customers', maintenance: true })
  const second = await migrateAuthLogin(payload, { collection: 'customers', maintenance: true })
  expect(second.generation).not.toBe(first.generation)
  clock += 1001
  expect(
    (await request('/auth/otp/send', { email: 'quota@example.com', purpose: 'verify-email' }))
      .status,
  ).toBe(200)
  expect(mailCount - start).toBe(5)
})
it('cutover removes only inventoried legacy codes and preserves other auth collections', async () => {
  const staff = await payload.create({
    collection: 'staff',
    data: { email: 'staff@example.com', password: 'staff password remains', _verified: true },
    disableVerificationEmail: true,
  })
  const staffLogin = await payload.login({
    collection: 'staff',
    data: { email: 'staff@example.com', password: 'staff password remains' },
  })
  await payload.create({
    collection: 'auth-otps',
    data: { scope: 'customers', token: 'retired customer code' },
  })
  await payload.create({
    collection: 'auth-otps',
    data: { scope: 'staff', token: 'unrelated staff code' },
  })
  const result = await migrateAuthLogin(payload, {
    collection: 'customers',
    maintenance: true,
    legacyOtpCollection: { slug: 'auth-otps', where: { scope: { equals: 'customers' } } },
  })
  expect(result.legacyCodesDeleted).toBe(1)
  expect((await payload.find({ collection: 'auth-otps' })).docs.map((doc) => doc.token)).toEqual([
    'unrelated staff code',
  ])
  expect(
    (await payload.auth({ headers: new Headers({ Authorization: `JWT ${staffLogin.token}` }) }))
      .user?.id,
  ).toBe(staff.id)
  expect((await payload.find({ collection: 'staff' })).docs).toHaveLength(1)
})
it('cutover rejects missing maintenance attestation without invalidating live authority', async () => {
  const login = await request('/auth/login', { email: 'cutoff@example.com', password: 'short' })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  await expect(
    migrateAuthLogin(payload, { collection: 'customers', maintenance: false as true }),
  ).rejects.toThrow('maintenance')
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeTruthy()
})
it('real database failure rolls back the entire cutoff, preserving prior sessions, codes and permits', async () => {
  const login = await request('/auth/login', { email: 'cutoff@example.com', password: 'short' })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const grant = await verify('rollback-owner@example.com', 'signup')
  clock += 1001
  const sent = await (
    await request('/auth/otp/send', { email: 'cutoff@example.com', purpose: 'recovery' })
  ).json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  await payload.create({
    collection: 'auth-otps',
    data: { scope: 'customers', token: 'rollback retained code' },
  })
  const before = (await payload.find({ collection: 'customers' })).docs.map((doc) => ({
    id: doc.id,
    email: doc.email,
    verified: doc._verified,
  }))
  const db = payload.db as unknown as {
    drizzle: unknown
    execute: (args: { db: unknown; raw: string }) => Promise<unknown>
    tableNameMap: Map<string, string>
  }
  const table = db.tableNameMap.get('auth-otps') ?? db.tableNameMap.get('auth_otps')
  expect(table).toBeTruthy()
  await db.execute({
    db: db.drizzle,
    raw: `CREATE TRIGGER cutoff_failure BEFORE DELETE ON "${table}" BEGIN SELECT RAISE(ABORT, 'deliberate real database cutoff failure'); END`,
  })
  try {
    await expect(
      migrateAuthLogin(payload, {
        collection: 'customers',
        maintenance: true,
        legacyOtpCollection: { slug: 'auth-otps', where: { scope: { equals: 'customers' } } },
      }),
    ).rejects.toThrow()
  } finally {
    await db.execute({ db: db.drizzle, raw: 'DROP TRIGGER cutoff_failure' })
  }
  expect(
    (await payload.find({ collection: 'customers' })).docs.map((doc) => ({
      id: doc.id,
      email: doc.email,
      verified: doc._verified,
    })),
  ).toEqual(before)
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeTruthy()
  expect(
    (
      await payload.find({ collection: 'auth-otps', where: { scope: { equals: 'customers' } } })
    ).docs.map((doc) => doc.token),
  ).toEqual(['rollback retained code'])
  expect(
    (
      await request('/auth/otp/verify', {
        email: 'cutoff@example.com',
        purpose: 'recovery',
        context: sent.context,
        otp,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request('/auth/signup', {
        permit: grant.permit,
        password: 'a new owner selected password',
      })
    ).status,
  ).toBe(200)
  expect(
    (await request('/auth/login', { email: 'cutoff@example.com', password: 'short' })).status,
  ).toBe(200)
})
it('cutover clears native legacy reset and verification tokens without manufacturing verified evidence', async () => {
  const user = await payload.create({
    collection: 'customers',
    context: { authLoginCredentialProvisioning: true },
    data: { email: 'tokenlegacy@example.com', password: 'short', _verified: false },
    disableVerificationEmail: true,
  })
  await payload.update({
    collection: 'customers',
    id: user.id,
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    data: {
      resetPasswordToken: 'legacy-reset-token',
      resetPasswordExpiration: new Date(Date.now() + 600000).toISOString(),
      _verificationToken: 'legacy-verification-token',
    },
  })
  const seeded = await payload.findByID({
    collection: 'customers',
    id: user.id,
    overrideAccess: true,
    showHiddenFields: true,
  })
  expect(seeded.resetPasswordToken).toBe('legacy-reset-token')
  expect(seeded._verificationToken).toBe('legacy-verification-token')
  await migrateAuthLogin(payload, { collection: 'customers', maintenance: true })
  const after = await payload.findByID({
    collection: 'customers',
    id: user.id,
    overrideAccess: true,
    showHiddenFields: true,
  })
  expect(after.resetPasswordToken).toBeNull()
  expect(after.resetPasswordExpiration).toBeNull()
  expect(after._verificationToken).toBeNull()
  expect(after._verified).toBe(false)
  expect((await request('/customers/verify/legacy-verification-token', {})).status).toBe(403)
  expect(
    (
      await request('/customers/reset-password', {
        token: 'legacy-reset-token',
        password: 'a replacement must be rejected',
      })
    ).status,
  ).toBe(403)
  expect(
    (await request('/auth/login', { email: 'tokenlegacy@example.com', password: 'short' })).status,
  ).toBe(401)
})
