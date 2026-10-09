import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin } from '../src/index'

let dir: string
let html = ''
let now = Date.now()
const instances: {
  payload: Payload
  config: Awaited<ReturnType<typeof buildConfig>>
  key: string
}[] = []
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'otp-default-http-'))
  for (let i = 0; i < 2; i++) {
    const otp = {
      origin: () => 'trusted-peer',
      now: () => now,
      cooldownSeconds: 1,
      email: { from: 'auth@example.com', locale: 'en' as const },
    }
    const plugin = authLoginPlugin({
      collection: 'customers',
      passwordLogin: true,
      otpLogin: true,
      providers: { google: false },
      allowSignup: true,
      recovery: true,
      otp,
    })
    // Endpoint factories must retain their captured, absent override after caller mutation.
    Object.assign(otp, { secret: `mutated-caller-secret-at-least-32-characters-${i}` })
    const config = await buildConfig({
      secret: 'shared-default-payload-secret-at-least-32-characters',
      db: sqliteAdapter({ client: { url: `file:${dir}/test.db` }, push: i === 0 }),
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
          auth: { useSessions: true, verify: true },
          access: { admin: () => false },
          fields: [],
        },
      ],
      plugins: [plugin],
    })
    const key = `otp-default-http-${i}`
    instances.push({ payload: await getPayload({ config, key }), config, key })
  }
  await instances[0].payload.create({
    collection: 'customers',
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    disableVerificationEmail: true,
    data: {
      email: 'owner@example.com',
      password: 'the river carries quiet dreams',
      _verified: true,
    },
  })
})
afterAll(async () => {
  for (const { payload } of instances) await payload.destroy()
  if (dir) await rm(dir, { recursive: true, force: true })
})
const request = (i: number, path: string, body: unknown, cookie?: string) =>
  handleEndpoints({
    config: instances[i].config,
    payloadInstanceCacheKey: instances[i].key,
    request: new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  })
async function proof(email: string, purpose: string, cookie?: string) {
  now += 1001
  const sent = await request(0, '/otp/send', { email, purpose }, cookie)
  expect(sent.status).toBe(200)
  const { context } = await sent.json()
  const otp = html.match(/>\s*(\d{6})\s*</)![1]
  const verified = await request(1, '/otp/verify', { email, purpose, context, otp }, cookie)
  expect(verified.status).toBe(200)
  return verified
}
it('authenticates across native Payload instances using only the shared root and captured configuration', async () => {
  const response = await proof('owner@example.com', 'login')
  expect((await response.json()).user.email).toBe('owner@example.com')
  expect(response.headers.get('set-cookie')).toBeTruthy()
})
it.each(['signup', 'recovery'])(
  'issues an ownership %s permit without an explicit key or session',
  async (purpose) => {
    const response = await proof(
      purpose === 'signup' ? 'new@example.com' : 'owner@example.com',
      purpose,
    )
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.json()).toMatchObject({ permit: expect.any(String) })
  },
)
it('reauthenticates email ownership without an override', async () => {
  const login = await request(0, '/login', {
    email: 'owner@example.com',
    password: 'the river carries quiet dreams',
  })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const response = await proof('owner@example.com', 'reauth', cookie)
  expect(response.headers.get('set-cookie')).toBeNull()
  expect(await response.json()).toMatchObject({ permit: expect.any(String) })
})
