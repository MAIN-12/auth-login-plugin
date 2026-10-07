import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin } from '../src/index'

let payload: Payload
let dir: string
let config: Awaited<ReturnType<typeof buildConfig>>
const key = 'auth-hardening-http'
const hooks: string[] = []
const plugin = authLoginPlugin({
  collection: 'customers',
  apiPrefix: '/backend',
  authEndpointPrefix: '/access',
  passwordLogin: true,
  otpLogin: false,
  providers: { google: false },
  allowSignup: false,
  recovery: false,
  session: { maxAge: 3 },
})
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'auth-hardening-'))
  config = await buildConfig({
    secret: 'integration-test-only-secret-not-production',
    cookiePrefix: 'custom',
    routes: { api: '/backend' },
    serverURL: 'http://localhost:3000',
    cors: ['http://localhost:3000'],
    csrf: ['http://localhost:3000'],
    db: sqliteAdapter({ client: { url: `file:${dir}/test.db` }, push: true }),
    collections: [
      {
        slug: 'customers',
        auth: {
          verify: true,
          useSessions: true,
          tokenExpiration: 900,
          removeTokenFromResponses: true,
          maxLoginAttempts: 2,
          lockTime: 60000,
          cookies: { sameSite: 'Lax' },
        },
        access: {
          read: ({ req }) => Boolean(req.user) && req.user?.email !== 'read-denied@example.com',
          create: () => false,
        },
        fields: [{ name: 'privateNote', type: 'text', access: { read: () => false } }],
        hooks: {
          beforeLogin: [
            ({ user }) => {
              hooks.push('beforeLogin')
              if (user.email === 'hook-denied@example.com')
                throw new Error('internal hook detail must remain private')
              return user
            },
          ],
          afterLogin: [
            ({ user }) => {
              hooks.push('afterLogin')
              if (user.email === 'after-hook-denied@example.com')
                throw new Error('internal after-hook detail must remain private')
              return user
            },
          ],
        },
      },
    ],
    plugins: [plugin],
    telemetry: false,
  })
  payload = await getPayload({ config, key })
  await payload.create({
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    collection: 'customers',
    data: { email: 'existing@example.com', password: 'existing legacy password', _verified: true },
    disableVerificationEmail: true,
  })
})
afterAll(async () => {
  await payload?.destroy()
  if (dir) await rm(dir, { recursive: true, force: true })
})
const request = (path: string, body?: unknown, cookie?: string, origin = 'http://localhost:3000') =>
  handleEndpoints({
    config,
    payloadInstanceCacheKey: key,
    request: new Request(`http://localhost:3000/backend${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        origin,
        ...(cookie ? { cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  })
it('authenticates actual existing credentials with Payload hooks, custom HTTP route and private token cookie', async () => {
  const response = await request('/access/login', {
    email: ' EXISTING@example.com ',
    password: 'existing legacy password',
  })
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.user.email).toBe('existing@example.com')
  expect(body).not.toHaveProperty('token')
  expect(response.headers.get('set-cookie')).toMatch(
    /^custom-token=.+;.*HttpOnly(=true)?; SameSite=Lax/,
  )
  expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
  expect(hooks).toEqual(['beforeLogin', 'afterLogin'])
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  expect((await (await request('/customers/me', undefined, cookie)).json()).user.email).toBe(
    'existing@example.com',
  )
})
it('refresh cannot extend the signed token beyond original session lifetime and logout revokes the token', async () => {
  const login = await request('/customers/login', {
    email: 'existing@example.com',
    password: 'existing legacy password',
  })
  const original = await login.json()
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  await new Promise((resolve) => setTimeout(resolve, 1100))
  const refresh = await request('/customers/refresh-token', {}, cookie)
  expect(refresh.status).toBe(200)
  const refreshed = await refresh.json()
  expect(refreshed.exp).toBeLessThanOrEqual(original.exp)
  expect(refreshed).not.toHaveProperty('refreshedToken')
  const newCookie = refresh.headers.get('set-cookie')!.split(';')[0]
  expect((await request('/customers/logout', {}, newCookie)).status).toBe(200)
  expect((await (await request('/customers/me', undefined, newCookie)).json()).user).toBeNull()
})
it('returns real non-secret credential evidence only to the account owner, including missing native credentials', async () => {
  expect((await request('/access/credentials')).status).toBe(401)
  const login = await request('/access/login', {
    email: 'existing@example.com',
    password: 'existing legacy password',
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const capabilities = await (await request('/access/credentials', undefined, cookie)).json()
  expect(capabilities).toEqual({
    capabilities: { password: 'available', emailVerification: 'verified' },
  })
  const temporary = await payload.create({
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    collection: 'customers',
    data: {
      email: 'no-password@example.com',
      password: 'temporary provisioned credential',
      _verified: true,
    },
    disableVerificationEmail: true,
  })
  const initial = await request('/access/login', {
    email: 'no-password@example.com',
    password: 'temporary provisioned credential',
  })
  const ownerCookie = initial.headers.get('set-cookie')!.split(';')[0]
  // Actual SQLite state, not a mocked public `user.password`: trusted provisioning removes local credentials.
  await payload.db.updateOne({
    collection: 'customers',
    id: temporary.id,
    data: { hash: null, salt: null },
  })
  expect(await (await request('/access/credentials', undefined, ownerCookie)).json()).toEqual({
    capabilities: { password: 'unavailable', emailVerification: 'verified' },
  })
  await payload.db.updateOne({
    collection: 'customers',
    id: temporary.id,
    data: { hash: null, salt: 'partial-evidence' },
  })
  expect(await (await request('/access/credentials', undefined, ownerCookie)).json()).toEqual({
    capabilities: { password: 'unknown', emailVerification: 'verified' },
  })
  const denied = await request('/access/login', {
    email: 'no-password@example.com',
    password: 'temporary provisioned credential',
  })
  expect(denied.status).toBe(401)
  expect(await denied.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
})
it('validates bounded JSON inputs before credential effects with stable public failures', async () => {
  const count = hooks.length
  for (const body of [
    null,
    [],
    { email: 42, password: 'x' },
    { email: 'invalid', password: 'x' },
    { email: 'existing@example.com', password: 'x'.repeat(1025) },
    { email: 'existing@example.com', password: 'x', purpose: 'other' },
  ]) {
    const response = await request('/access/login', body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, code: 'INVALID_INPUT' })
    expect(response.headers.get('set-cookie')).toBeNull()
  }
  for (const body of ['{broken', JSON.stringify({ email: 'x'.repeat(5000), password: 'x' })]) {
    const response = await handleEndpoints({
      config,
      payloadInstanceCacheKey: key,
      request: new Request('http://localhost:3000/backend/access/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, code: 'INVALID_INPUT' })
  }
  expect(hooks.length).toBe(count)
})
it('does not enumerate accounts and denies disabled native and plugin routes', async () => {
  const unknown = await request('/access/login', { email: 'unknown@example.com', password: 'bad' })
  const wrong = await request('/access/login', { email: 'existing@example.com', password: 'bad' })
  expect(unknown.status).toBe(401)
  expect(await unknown.json()).toEqual(await wrong.json())
  for (const path of [
    '/access/check-email',
    '/access/otp/send',
    '/access/otp/verify',
    '/access/signup',
    '/access/set-password',
    '/customers/forgot-password',
    '/customers/reset-password',
    '/customers/first-register',
  ]) {
    const response = await request(path, {
      email: 'existing@example.com',
      password: 'bad',
      otp: '123456',
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ success: false, code: 'METHOD_DISABLED' })
  }
  await expect(
    payload.forgotPassword({ collection: 'customers', data: { email: 'existing@example.com' } }),
  ).rejects.toThrow('METHOD_DISABLED')
})
it('keeps Payload lockouts and verification enforcement instead of substituting credentials', async () => {
  await payload.create({
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    collection: 'customers',
    data: { email: 'locked@example.com', password: 'existing legacy password', _verified: true },
    disableVerificationEmail: true,
  })
  await request('/access/login', { email: 'locked@example.com', password: 'bad' })
  await request('/access/login', { email: 'locked@example.com', password: 'bad' })
  expect(
    (
      await request('/access/login', {
        email: 'locked@example.com',
        password: 'existing legacy password',
      })
    ).status,
  ).toBe(401)
  await payload.create({
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    collection: 'customers',
    data: { email: 'unverified@example.com', password: 'existing legacy password' },
    disableVerificationEmail: true,
  })
  expect(
    (
      await request('/access/login', {
        email: 'unverified@example.com',
        password: 'existing legacy password',
      })
    ).status,
  ).toBe(401)
})
it('uses the effective host CORS/CSRF policy for login and authenticated refresh', async () => {
  const blocked = await request(
    '/access/login',
    { email: 'existing@example.com', password: 'existing legacy password' },
    undefined,
    'https://evil.example',
  )
  expect(blocked.status).toBe(403)
  expect(blocked.headers.get('access-control-allow-origin')).toBeNull()
  expect(blocked.headers.get('set-cookie')).toBeNull()
  const login = await request('/access/login', {
    email: 'existing@example.com',
    password: 'existing legacy password',
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  expect(
    (await request('/customers/refresh-token', {}, cookie, 'https://evil.example')).status,
  ).toBe(403)
  expect(
    (await (await request('/customers/me', undefined, cookie, 'https://evil.example')).json()).user,
  ).toBeNull()
})
it('expires authentication at the absolute deadline despite refresh and rejects replay after logout', async () => {
  const login = await request('/access/login', {
    email: 'existing@example.com',
    password: 'existing legacy password',
  })
  const body = await login.json()
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  expect(body.capabilities).toEqual({ password: 'available', emailVerification: 'verified' })
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, body.exp * 1000 - Date.now()) + 100),
  )
  expect((await (await request('/customers/me', undefined, cookie)).json()).user).toBeNull()
  expect((await request('/customers/refresh-token', {}, cookie)).status).toBe(401)
})
it('isolates a second Payload instance and honors an auth token lifetime smaller than maxAge', async () => {
  const secondPlugin = authLoginPlugin({
    collection: 'members',
    apiPrefix: '/other',
    authEndpointPrefix: '/sign-in',
    passwordLogin: true,
    otpLogin: false,
    providers: { google: false },
    allowSignup: false,
    recovery: false,
    logo: '/other.svg',
    session: { maxAge: 7200 },
  })
  const secondConfig = await buildConfig({
    secret: 'second-private-integration-secret',
    cookiePrefix: 'other',
    routes: { api: '/other' },
    db: sqliteAdapter({ client: { url: `file:${dir}/second.db` }, push: true }),
    collections: [
      {
        slug: 'members',
        auth: { useSessions: true, verify: true, tokenExpiration: 2 },
        fields: [],
      },
    ],
    plugins: [secondPlugin],
    telemetry: false,
  })
  const other = await getPayload({ config: secondConfig, key: 'auth-hardening-second' })
  try {
    await other.create({
      overrideAccess: true,
      context: { authLoginCredentialProvisioning: true },
      collection: 'members',
      data: {
        email: 'existing@example.com',
        password: 'different existing password',
        _verified: true,
      },
      disableVerificationEmail: true,
    })
    const response = await handleEndpoints({
      config: secondConfig,
      payloadInstanceCacheKey: 'auth-hardening-second',
      request: new Request('http://localhost:3000/other/sign-in/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'different existing password',
        }),
      }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/^other-token=/)
    const body = await response.json()
    expect(body.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 2)
    expect(secondPlugin.publicConfig.logoUrl).toBe('/other.svg')
    const rejected = await request('/access/login', {
      email: 'existing@example.com',
      password: 'different existing password',
    })
    expect(rejected.status).toBe(401)
    expect(
      (
        await request('/access/login', {
          email: 'existing@example.com',
          password: 'existing legacy password',
        })
      ).status,
    ).toBe(200)
  } finally {
    await other.destroy()
  }
})

it('respects rejecting native login hooks without publishing internal exceptions or issuing cookies', async () => {
  for (const email of ['hook-denied@example.com', 'after-hook-denied@example.com']) {
    await payload.create({
      overrideAccess: true,
      context: { authLoginCredentialProvisioning: true },
      collection: 'customers',
      data: { email, password: 'real hook-test password', _verified: true },
      disableVerificationEmail: true,
    })
    const response = await request('/access/login', { email, password: 'real hook-test password' })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ success: false, code: 'AUTH_FAILED' })
    expect(response.headers.get('set-cookie')).toBeNull()
  }
})

it('preserves native collection and field access semantics without inventing a login permission', async () => {
  await payload.create({
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
    collection: 'customers',
    data: {
      email: 'read-denied@example.com',
      password: 'real read-access-test password',
      _verified: true,
      privateNote: 'must not be public',
    },
    disableVerificationEmail: true,
  })
  const response = await request('/access/login', {
    email: 'read-denied@example.com',
    password: 'real read-access-test password',
  })
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.user).not.toHaveProperty('privateNote')
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  expect((await request('/customers/me', undefined, cookie)).status).toBe(403)
  expect((await request('/customers', undefined, cookie)).status).toBe(403)
})
it('denies an authenticated native password PATCH before effects instead of accepting an old session as reauthentication', async () => {
  const login = await request('/access/login', {
    email: 'existing@example.com',
    password: 'existing legacy password',
  })
  const { user } = await login.json()
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const patched = await handleEndpoints({
    config,
    payloadInstanceCacheKey: key,
    request: new Request(`http://localhost:3000/backend/customers/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', cookie },
      body: JSON.stringify({ password: 'replacement long password' }),
    }),
  })
  expect(patched.status).toBe(403)
  expect(patched.headers.get('set-cookie')).toBeNull()
  expect(
    (
      await request('/access/login', {
        email: 'existing@example.com',
        password: 'replacement long password',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request('/access/login', {
        email: 'existing@example.com',
        password: 'existing legacy password',
      })
    ).status,
  ).toBe(200)
  expect((await (await request('/customers/me', undefined, cookie)).json()).user.email).toBe(
    'existing@example.com',
  )
})
it('requires explicit server-only Local API privilege for credential provisioning and rejects request-origin overrides', async () => {
  await expect(
    payload.create({
      collection: 'customers',
      data: {
        email: 'not-privileged@example.com',
        password: 'a provisioned long password',
        _verified: true,
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    }),
  ).rejects.toThrow('METHOD_DISABLED')
  const account = await payload.create({
    collection: 'customers',
    data: {
      email: 'maintenance@example.com',
      password: 'original maintenance password',
      _verified: true,
    },
    disableVerificationEmail: true,
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
  })
  await expect(
    payload.update({
      collection: 'customers',
      id: account.id,
      data: { password: 'replacement maintenance password' },
      overrideAccess: false,
      context: { authLoginCredentialProvisioning: true },
    }),
  ).rejects.toThrow('METHOD_DISABLED')
  await expect(
    payload.update({
      collection: 'customers',
      id: account.id,
      data: { password: 'replacement maintenance password' },
      overrideAccess: true,
    }),
  ).rejects.toThrow('METHOD_DISABLED')
  await payload.update({
    collection: 'customers',
    id: account.id,
    data: { password: 'replacement maintenance password' },
    overrideAccess: true,
    context: { authLoginCredentialProvisioning: true },
  })
  expect(
    (
      await request('/access/login', {
        email: 'maintenance@example.com',
        password: 'replacement maintenance password',
      })
    ).status,
  ).toBe(200)
  const { createPayloadRequest } = await import('payload')
  for (const path of ['/customers', '/graphql']) {
    const req = await createPayloadRequest({
      config,
      payloadInstanceCacheKey: key,
      request: new Request(`http://localhost:3000/backend${path}`, {
        headers: { origin: 'http://localhost:3000' },
      }),
    })
    expect(req.payloadAPI).toBe(path === '/graphql' ? 'GraphQL' : 'REST')
    await expect(
      payload.update({
        collection: 'customers',
        id: account.id,
        data: { password: 'request-origin replacement password' },
        overrideAccess: true,
        context: { authLoginCredentialProvisioning: true },
        req,
      }),
    ).rejects.toThrow('METHOD_DISABLED')
  }
  expect(
    (
      await request('/access/login', {
        email: 'maintenance@example.com',
        password: 'replacement maintenance password',
      })
    ).status,
  ).toBe(200)
})
