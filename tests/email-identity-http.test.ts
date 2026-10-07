import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  buildConfig,
  createPayloadRequest,
  getPayload,
  handleEndpoints,
  type Payload,
} from 'payload'
import { GRAPHQL_POST } from '@payloadcms/next/routes'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginPlugin } from '../src/index'

let dir: string
let payload: Payload
let config: Awaited<ReturnType<typeof buildConfig>>
let account: { id: number | string }
let cookie: string
const trusted = {
  overrideAccess: true,
  context: { authLoginCredentialProvisioning: true },
} as const
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'email-identity-'))
  config = await buildConfig({
    secret: 'email-identity-disposable-secret-32-characters',
    routes: { api: '/backend' },
    db: sqliteAdapter({ client: { url: `file:${dir}/test.db` }, push: true }),
    collections: [
      {
        slug: 'customers',
        auth: { verify: true, useSessions: true },
        access: { update: ({ req }) => Boolean(req.user) },
        fields: [{ name: 'displayName', type: 'text' }],
      },
    ],
    plugins: [
      authLoginPlugin({
        collection: 'customers',
        apiPrefix: '/backend',
        authEndpointPrefix: '/access',
        passwordLogin: true,
        otpLogin: false,
        providers: { google: false },
        allowSignup: false,
        recovery: false,
      }),
    ],
    telemetry: false,
  })
  // GraphQL's native HTTP handler uses Payload's default instance cache.
  payload = await getPayload({ config })
  account = await payload.create({
    collection: 'customers',
    ...trusted,
    data: { email: 'owner@example.com', password: 'original legacy password', _verified: true },
    disableVerificationEmail: true,
  })
  const response = await handleEndpoints({
    config,
    request: new Request('http://localhost:3000/backend/access/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'original legacy password' }),
    }),
  })
  expect(response.status).toBe(200)
  cookie = response.headers.get('Set-Cookie')!.split(';')[0]
})
afterAll(async () => {
  await payload?.destroy()
  if (dir) await rm(dir, { recursive: true, force: true })
})
const record = () =>
  payload.findByID({ collection: 'customers', id: account.id, overrideAccess: true })
const patch = (data: unknown) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost:3000/backend/customers/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(data),
    }),
  })
it('denies public REST email writes, including no-ops, without transferring verification or blocking unrelated profile updates', async () => {
  for (const email of ['attacker@example.com', 'owner@example.com'])
    expect((await patch({ email })).status).toBe(403)
  const bulk = await handleEndpoints({
    config,
    request: new Request(
      `http://localhost:3000/backend/customers?where[id][equals]=${account.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ email: 'attacker@example.com' }),
      },
    ),
  })
  expect(bulk.status).toBe(403)
  expect(await record()).toMatchObject({ email: 'owner@example.com', _verified: true })
  expect((await patch({ displayName: 'Changed profile' })).status).toBe(200)
  expect(await record()).toMatchObject({
    email: 'owner@example.com',
    displayName: 'Changed profile',
  })
})
it('denies a real GraphQL email mutation before transferring verified identity', async () => {
  const response = await GRAPHQL_POST(config)(
    new Request('http://localhost:3000/backend/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        query: `mutation { updateCustomer(id: ${account.id}, data: { email: "attacker@example.com" }) { id email } }`,
      }),
    }),
  )
  const body = await response.json()
  expect(body.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: 'METHOD_DISABLED',
        extensions: expect.objectContaining({ statusCode: 403 }),
      }),
    ]),
  )
  expect(await record()).toMatchObject({ email: 'owner@example.com', _verified: true })
})
it('requires both explicit trusted Local API provisioning flags and rejects REST/GraphQL-origin forwarding', async () => {
  for (const flags of [
    { overrideAccess: true },
    { overrideAccess: false, context: trusted.context },
  ])
    await expect(
      payload.update({
        collection: 'customers',
        id: account.id,
        data: { email: 'attacker@example.com' },
        ...flags,
      }),
    ).rejects.toThrow('METHOD_DISABLED')
  await expect(
    payload.update({
      collection: 'customers',
      where: { id: { equals: account.id } },
      data: { email: 'attacker@example.com' },
      overrideAccess: true,
    }),
  ).rejects.toThrow('METHOD_DISABLED')
  for (const path of ['/customers', '/graphql']) {
    const req = await createPayloadRequest({
      config,
      request: new Request(`http://localhost:3000/backend${path}`, { headers: { cookie } }),
    })
    await expect(
      payload.update({
        collection: 'customers',
        id: account.id,
        data: { email: 'attacker@example.com' },
        ...trusted,
        req,
      }),
    ).rejects.toThrow('METHOD_DISABLED')
  }
  expect(await record()).toMatchObject({ email: 'owner@example.com', _verified: true })
  await payload.update({
    collection: 'customers',
    id: account.id,
    data: { email: 'trusted-new@example.com', _verified: false },
    ...trusted,
  })
  expect(await record()).toMatchObject({ email: 'trusted-new@example.com', _verified: false })
})
