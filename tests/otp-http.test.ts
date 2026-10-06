import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin } from '../src/index'
let dir: string
const instances: { payload: Payload; config: Awaited<ReturnType<typeof buildConfig>>; key: string }[] = []
const mail: string[] = []
const adminEligible = new Set(['admin@example.com'])
let now = Date.now()
const options = { collection: 'customers', apiPrefix: '/backend', authEndpointPrefix: '/access', passwordLogin: true, otpLogin: true, providers: { google: false as const }, allowSignup: false, recovery: false, otp: { secret: 'test-dedicated-otp-key-32-characters-long', origin: () => 'trusted-peer', now: () => now, email: { from: 'auth@example.com', locale: 'es' as const, projectName: '<script>brand</script>' } } }
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'otp-http-'))
  for (let i = 0; i < 2; i++) {
    const config = await buildConfig({ secret: 'shared-test-payload-secret-32-characters', db: sqliteAdapter({ client: { url: `file:${dir}/test.db` }, push: i === 0 }), email: () => ({ name: 'test', defaultFromAddress: 'auth@example.com', defaultFromName: 'Test', sendEmail: async message => { mail.push(String(message.html)); return undefined } }), collections: [{ slug: 'customers', auth: { useSessions: true, verify: true, removeTokenFromResponses: true, maxLoginAttempts: 2 }, access: { admin: ({ req }) => adminEligible.has(String(req.user?.email)) }, fields: [{ name: 'secretNote', type: 'text', access: { read: () => false } }], hooks: { beforeLogin: [({ user }) => { if (user.email === 'denied@example.com') throw new Error('private hook detail'); return user }] } }], plugins: [authLoginPlugin(options)], telemetry: false })
    const key = `otp-http-${i}`
    instances.push({ payload: await getPayload({ config, key }), config, key })
  }
  for (const email of ['user@example.com', 'denied@example.com', 'attempts@example.com', 'other@example.com', 'locked@example.com', 'admin@example.com', 'dynamic@example.com', 'changed@example.com']) await instances[0].payload.create({ collection: 'customers', overrideAccess: true, context: { authLoginCredentialProvisioning: true }, data: { email, password: 'unchanged existing password', _verified: true, secretNote: 'not public' }, disableVerificationEmail: true })
  await instances[0].payload.create({ collection: 'customers', overrideAccess: true, context: { authLoginCredentialProvisioning: true }, data: { email: 'unverified@example.com', password: 'unchanged existing password' }, disableVerificationEmail: true })
})
afterAll(async () => { for (const instance of instances) await instance.payload.destroy(); if (dir) await rm(dir, { recursive: true, force: true }) })
const request = (i: number, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) => handleEndpoints({ config: instances[i].config, payloadInstanceCacheKey: instances[i].key, request: new Request(`http://localhost:3000/backend${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers, ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) })
const send = async (email: string, context?: string, instance = 0) => { const response = await request(instance, '/access/otp/send', { email, purpose: 'login', ...(context ? { context } : {}) }); expect(response.status).toBe(200); return response.json() }
const code = () => mail.at(-1)!.match(/letter-spacing:8px">(\d{6})/)![1]
it('real SQLite HTTP authenticates once across instances and preserves password, hooks, field privacy and old session', async () => {
  const password = await request(0, '/access/login', { email: 'user@example.com', password: 'unchanged existing password' })
  const oldCookie = password.headers.get('set-cookie')!.split(';')[0]
  const sent = await send('user@example.com')
  const otp = code()
  const results = await Promise.all([0, 1].map(i => request(i, '/access/otp/verify', { email: 'user@example.com', purpose: 'login', context: sent.context, otp })))
  expect(results.map(response => response.status).sort()).toEqual([200, 401])
  const success = results.find(response => response.status === 200)!
  const result = await success.json()
  expect(result).not.toHaveProperty('token')
  expect(result.user).not.toHaveProperty('secretNote')
  const cookie = success.headers.get('set-cookie')!.split(';')[0]
  expect((await (await request(1, '/customers/me', undefined, oldCookie)).json()).user.email).toBe('user@example.com')
  expect((await (await request(0, '/customers/me', undefined, cookie)).json()).user.email).toBe('user@example.com')
  expect((await request(1, '/access/login', { email: 'user@example.com', password: 'unchanged existing password' })).status).toBe(200)
})
it('shared cooldown and atomic attempt budgets reject direct cross-instance abuse and preserve original TTL on resend', async () => {
  const sent = await send('attempts@example.com')
  const originalCode = code()
  const count = mail.length
  await send('attempts@example.com', sent.context, 1)
  expect(mail).toHaveLength(count)
  now += 60_000
  await send('attempts@example.com', sent.context, 1)
  expect(code()).toBe(originalCode)
  const failed = await Promise.all([0, 1, 0].map(i => request(i, '/access/otp/verify', { email: 'attempts@example.com', purpose: 'login', context: sent.context, otp: originalCode === '000000' ? '111111' : '000000' })))
  expect(failed.every(response => response.status === 401)).toBe(true)
  expect((await request(1, '/access/otp/verify', { email: 'attempts@example.com', purpose: 'login', context: sent.context, otp: originalCode })).status).toBe(401)
  now += 240_000
  expect((await request(0, '/access/otp/verify', { email: 'attempts@example.com', purpose: 'login', context: sent.context, otp: originalCode })).status).toBe(401)
})
it('sanitizes mail branding and contracts, rejects other purpose/context, and honors native deny hooks', async () => {
  const known = await send('denied@example.com')
  const otp = code()
  const unknown = await send('missing@example.com')
  expect({ ...unknown, context: known.context }).toEqual(known)
  expect(mail.at(-1)).toContain('&lt;script&gt;brand&lt;/script&gt;')
  expect(mail.at(-1)).not.toContain('<script>')
  expect((await request(0, '/access/otp/verify', { email: 'denied@example.com', purpose: 'password-reset', context: known.context, otp })).status).toBe(400)
  const denied = await request(1, '/access/otp/verify', { email: 'denied@example.com', purpose: 'login', context: known.context, otp })
  expect(denied.status).toBe(401)
  expect(await denied.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
  expect(denied.headers.get('set-cookie')).toBeNull()
  for (const path of ['/auth-login-otp-security', '/auth_login_otp_security']) expect((await request(0, path)).status).toBe(404)
})
it('overlapping password login and OTP login preserve both sessions instead of overwriting native arrays', async () => {
  for (let round = 0; round < 3; round++) {
    now += 60_000
    const sent = await send('other@example.com')
    const otp = code()
    const [password, verified] = await Promise.all([
      request(0, '/customers/login', { email: 'other@example.com', password: 'unchanged existing password' }),
      request(1, '/access/otp/verify', { email: 'other@example.com', purpose: 'login', context: sent.context, otp }),
    ])
    expect([password.status, verified.status]).toEqual([200, 200])
    for (const response of [password, verified]) {
      const cookie = response.headers.get('set-cookie')!.split(';')[0]
      expect((await (await request(0, '/customers/me', undefined, cookie)).json()).user?.email).toBe('other@example.com')
    }
  }
})
it('overlapping OTP, refresh and logout never resurrect revoked native sessions', async () => {
  now += 60_000
  const first = await request(0, '/access/login', { email: 'user@example.com', password: 'unchanged existing password' })
  const revokedCookie = first.headers.get('set-cookie')!.split(';')[0]
  const second = await request(0, '/access/login', { email: 'user@example.com', password: 'unchanged existing password' })
  const keptCookie = second.headers.get('set-cookie')!.split(';')[0]
  const sent = await send('user@example.com')
  const otp = code()
  const [logout, refresh, verified] = await Promise.all([
    request(0, '/customers/logout', {}, revokedCookie),
    request(1, '/customers/refresh-token', {}, keptCookie),
    request(1, '/access/otp/verify', { email: 'user@example.com', purpose: 'login', context: sent.context, otp }),
  ])
  expect([logout.status, refresh.status, verified.status]).toEqual([200, 200, 200])
  expect((await (await request(1, '/customers/me', undefined, revokedCookie)).json()).user).toBeNull()
  const otpCookie = verified.headers.get('set-cookie')!.split(';')[0]
  expect((await (await request(0, '/customers/me', undefined, otpCookie)).json()).user?.email).toBe('user@example.com')
  expect((await request(1, '/customers/refresh-token', {}, revokedCookie)).status).toBe(401)
})

it('OTP cannot bypass native locks, unverified accounts or admin-only eligibility', async () => {
  for (let i = 0; i < 2; i++) expect((await request(0, '/access/login', { email: 'locked@example.com', password: 'wrong-password' })).status).toBe(401)
  for (const email of ['locked@example.com', 'unverified@example.com', 'admin@example.com']) {
    const sent = await send(email)
    const otp = code()
    const denied = await request(1, '/access/otp/verify', { email, purpose: 'login', context: sent.context, otp })
    expect(denied.status).toBe(401)
    expect(denied.headers.get('set-cookie')).toBeNull()
    expect(await denied.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
  }
  expect((await request(0, '/access/login', { email: 'admin@example.com', password: 'unchanged existing password' })).status).toBe(200)
})
it('logout-all revokes every preexisting session without stale-write resurrection during OTP overlap', async () => {
  now += 60_000
  const prior = await Promise.all([0, 1].map(i => request(i, '/access/login', { email: 'other@example.com', password: 'unchanged existing password' })))
  expect(prior.map(response => response.status)).toEqual([200, 200])
  const cookies = prior.map(response => response.headers.get('set-cookie')!.split(';')[0])
  const sent = await send('other@example.com')
  const otp = code()
  const [logoutAll, verified] = await Promise.all([
    request(0, '/customers/logout?allSessions=true', {}, cookies[0]),
    request(1, '/access/otp/verify', { email: 'other@example.com', purpose: 'login', context: sent.context, otp }),
  ])
  expect([logoutAll.status, verified.status]).toEqual([200, 200])
  for (const cookie of cookies) expect((await (await request(1, '/customers/me', undefined, cookie)).json()).user).toBeNull()
  // Overlapping newly authorized OTP may legally linearize after logout-all; old tokens never revive.
})

it('signed OTP method survives refresh and denies native admin eligibility changes on later requests', async () => {
  const sent = await send('dynamic@example.com')
  const otp = code()
  const login = await request(0, '/access/otp/verify', { email: 'dynamic@example.com', purpose: 'login', context: sent.context, otp })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const refreshed = await request(1, '/customers/refresh-token', {}, cookie)
  expect(refreshed.status).toBe(200)
  const refreshedCookie = refreshed.headers.get('set-cookie')!.split(';')[0]
  adminEligible.add('dynamic@example.com')
  for (const tokenCookie of [cookie, refreshedCookie]) {
    expect((await (await request(0, '/customers/me', undefined, tokenCookie)).json()).user).toBeNull()
    expect((await request(1, '/customers/refresh-token', {}, tokenCookie)).status).toBe(401)
    const administrative = await request(1, '/customers/access', undefined, tokenCookie)
    expect(administrative.status).toBe(403)
  }
})

it('real HTTP OTP issued before email reassignment cannot authenticate the replacement account', async () => {
  const original = await request(0, '/access/login', { email: 'changed@example.com', password: 'unchanged existing password' })
  expect(original.status).toBe(200)
  const originalCookie = original.headers.get('set-cookie')!.split(';')[0]
  const originalUser = (await original.json()).user
  const sent = await send('changed@example.com')
  const otp = code()
  const renamed = await handleEndpoints({ config: instances[0].config, payloadInstanceCacheKey: instances[0].key, request: new Request(`http://localhost:3000/backend/customers/${originalUser.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: originalCookie }, body: JSON.stringify({ email: 'moved@example.com' }) }) })
  expect(renamed.status).toBe(200)
  expect((await (await request(1, `/customers/${originalUser.id}`, undefined, originalCookie)).json()).email).toBe('moved@example.com')
  await instances[0].payload.create({ collection: 'customers', overrideAccess: true, context: { authLoginCredentialProvisioning: true }, data: { email: 'changed@example.com', password: 'different replacement password', _verified: true }, disableVerificationEmail: true })
  const verify = await request(1, '/access/otp/verify', { email: 'changed@example.com', purpose: 'login', context: sent.context, otp })
  expect(verify.status).toBe(401)
  expect(verify.headers.get('set-cookie')).toBeNull()
  expect(await verify.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
})

it('crafted public update metadata cannot mutate credentials or resurrect a logged-out session', async () => {
  const login = await request(0, '/access/login', { email: 'moved@example.com', password: 'unchanged existing password' })
  expect(login.status).toBe(200)
  const user = (await login.json()).user
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const sid = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[1], 'base64url').toString()).sid
  const active = await request(1, '/access/login', { email: 'moved@example.com', password: 'unchanged existing password' })
  const activeCookie = active.headers.get('set-cookie')!.split(';')[0]
  const patch = (data: unknown) => handleEndpoints({ config: instances[0].config, payloadInstanceCacheKey: instances[0].key, request: new Request(`http://localhost:3000/backend/customers/${user.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: activeCookie }, body: JSON.stringify(data) }) })
  const forged = await patch({ password: 'attacker replacement credential', _strategy: 'local-jwt', updatedAt: null })
  expect(forged.status).toBe(403)
  expect((await request(1, '/access/login', { email: 'moved@example.com', password: 'unchanged existing password' })).status).toBe(200)
  expect((await request(0, '/customers/logout', {}, cookie)).status).toBe(200)
  const resurrection = await patch({ _strategy: 'local-jwt', _sid: sid, authLoginMethod: 'password', updatedAt: null, sessions: [{ id: sid, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() }] })
  expect(resurrection.status).toBe(403)
  expect((await (await request(1, '/customers/me', undefined, cookie)).json()).user).toBeNull()
})
