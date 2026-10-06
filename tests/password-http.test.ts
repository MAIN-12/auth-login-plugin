import { afterAll, beforeAll, expect, it } from 'vitest'
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
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), key))
  config = await buildConfig({ secret: 'shared-lifecycle-secret-32-characters', db: sqliteAdapter({ client: { url: `file:${dir}/test.db` } }), telemetry: false,
    email: () => ({ name: 'test', defaultFromAddress: 'auth@example.com', defaultFromName: 'Test', sendEmail: async mail => { html = String(mail.html) } }),
    collections: [{ slug: 'customers', auth: { useSessions: true, verify: true, removeTokenFromResponses: true }, access: { admin: () => false }, fields: [], hooks: { beforeChange: [({ data }) => { if (failChange) throw new Error('fixture failure'); return data }] } }],
    plugins: [authLoginPlugin({ collection: 'customers', passwordLogin: true, otpLogin: false, providers: { google: false }, allowSignup: true, recovery: true,
      otp: { secret: 'dedicated-lifecycle-secret-32-characters', origin: () => 'trusted-peer', email: { from: 'auth@example.com', locale: 'en' } } })],
  })
  payload = await getPayload({ config, key })
})
afterAll(async () => { await payload?.destroy(); if (dir) await rm(dir, { recursive: true, force: true }) })
const request = (path: string, body?: unknown, cookie?: string) => handleEndpoints({ config, payloadInstanceCacheKey: key, request: new Request(`http://localhost:3000/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) })
async function verify(email: string, purpose: string) {
  const sentResponse = await request('/auth/otp/send', { email, purpose })
  expect(sentResponse.status).toBe(200)
  const sent = await sentResponse.json()
  const otp = html.match(/letter-spacing:8px">(\d{6})/)![1]
  const response = await request('/auth/otp/verify', { email, purpose, context: sent.context, otp })
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  return response.json()
}
it('real native signup commits an owner-chosen credential once after email proof, without session', async () => {
  const grant = await verify('owner@example.com', 'signup')
  const response = await request('/auth/signup', { permit: grant.permit, password: 'the river carries quiet dreams' })
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  expect((await request('/auth/signup', { permit: grant.permit, password: 'another owner chosen phrase' })).status).toBe(401)
  expect((await request('/auth/login', { email: 'owner@example.com', password: 'the river carries quiet dreams' })).status).toBe(200)
}, 20000)
it('native hook failure rolls back reset credential, sessions and single-use consumption', async () => {
  const login = await request('/auth/login', { email: 'owner@example.com', password: 'the river carries quiet dreams' })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const grant = await verify('owner@example.com', 'recovery')
  failChange = true
  expect((await request('/auth/reset-password', { permit: grant.permit, password: 'a different owner chosen phrase' })).status).toBe(401)
  failChange = false
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeTruthy()
  expect((await request('/auth/reset-password', { permit: grant.permit, password: 'a different owner chosen phrase' })).status).toBe(200)
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeNull()
  expect((await request('/auth/reset-password', { permit: grant.permit, password: 'yet another owner chosen phrase' })).status).toBe(401)
})
it('native password reauthentication never adds a session and change rotates within its original absolute cap', async () => {
  const login = await request('/auth/login', { email: 'owner@example.com', password: 'a different owner chosen phrase' })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const old = await payload.db.findOne<NonNullable<import('payload').PayloadRequest['user']>>({ collection: 'customers', where: { email: { equals: 'owner@example.com' } } })
  expect(old!.sessions).toHaveLength(1)
  const response = await request('/auth/reauthenticate', { password: 'a different owner chosen phrase' }, cookie)
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toBeNull()
  const unchanged = await payload.db.findOne<NonNullable<import('payload').PayloadRequest['user']>>({ collection: 'customers', where: { id: { equals: old!.id } } })
  expect(unchanged!.sessions).toEqual(old!.sessions)
  const grant = await response.json()
  const changed = await request('/auth/set-password', { permit: grant.permit, password: 'one more owner chosen phrase' }, cookie)
  expect(changed.status).toBe(200)
  const currentCookie = changed.headers.get('set-cookie')!.split(';')[0]
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeNull()
  expect((await (await request('/customers/me', undefined, currentCookie)).json()).user).toBeTruthy()
  const current = await payload.db.findOne<NonNullable<import('payload').PayloadRequest['user']>>({ collection: 'customers', where: { id: { equals: old!.id } } })
  expect((current!.sessions as Array<{ createdAt: string }>)[0].createdAt).toEqual((old!.sessions as Array<{ createdAt: string }>)[0].createdAt)
})
it('strict ownership HTTP schemas reject extra authority fields, unknown purposes and wrong scalar types', async () => {
  for (const [path, body] of [
    ['/auth/otp/send', { email: 'schema@example.com', purpose: 'signup', role: 'admin' }],
    ['/auth/otp/send', { email: 'schema@example.com', purpose: 'not-a-purpose' }],
    ['/auth/otp/verify', { email: 'schema@example.com', purpose: 'recovery', context: 'a'.repeat(64), otp: 123456 }],
    ['/auth/forgot-password', { email: 'schema@example.com', password: 'must not be reserved' }],
    ['/auth/reauthenticate', { password: 123 }],
    ['/auth/signup', { permit: 'opaque', password: 'the river carries quiet dreams', email: 'retarget@example.com' }],
  ] as const) {
    const response = await request(path, body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, code: 'INVALID_INPUT' })
  }
})
