import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authLoginCollections } from '../src/collections'
import { resolveGoogleAccount } from '../src/authentication/infrastructure/payload/googleAccountCommit'
import { findIdentityAccount } from '../src/collections/AuthLoginIdentities'
import { findNativeAccountById } from '../src/collections/ConfiguredAuthCollection/infrastructure/queries/nativeAccounts'
import { credentialVersion } from '../src/collections/ConfiguredAuthCollection/infrastructure/payload/credentialRequest'
import { publicConfig } from './auth-test-config'

let payload: Payload
let directory: string
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'auth-google-account-'))
  const config = await buildConfig({
    secret: 'google-native-sqlite-test-secret',
    telemetry: false,
    db: sqliteAdapter({ client: { url: `file:${directory}/test.db` }, push: true }),
    collections: [
      {
        slug: 'customers',
        auth: { useSessions: true, verify: true },
        fields: [
          { name: 'roles', type: 'select', hasMany: true, options: ['superadmin', 'customer'] },
        ],
      },
      ...authLoginCollections,
    ],
  })
  payload = await getPayload({ config, key: `google-native-${directory}` })
}, 60_000)
afterAll(async () => {
  await payload?.destroy()
  if (directory) await rm(directory, { recursive: true, force: true })
})

it('real SQLite native Workspace association re-reads a verified password superadmin inside the same transaction', async () => {
  const email = 'owner@main12.com'
  const user = await payload.create({
    collection: 'customers',
    data: {
      email,
      password: 'native integration password',
      _verified: true,
      roles: ['superadmin'],
    },
    disableVerificationEmail: true,
  })
  const req = await createLocalReq({}, payload)
  const before = await findNativeAccountById(req, 'customers', user.id)
  expect(before?._verified).toBe(true)
  expect(before?.hash).toEqual(expect.any(String))
  const settings = {
    ...publicConfig,
    collection: 'customers',
    googleOAuthEnabled: true,
    allowSignup: false,
  }
  const correlation = {
    state: 'a'.repeat(43),
    nonce: 'nonce',
    verifier: 'verifier',
    browser: 'browser',
    returnTo: '/',
    expiresAt: 601000,
    purpose: 'login' as const,
  }
  const identity = {
    sub: 'sqlite-workspace-subject',
    email,
    emailVerified: true,
    hostedDomain: 'main12.com',
  }
  const result = await resolveGoogleAccount(req, settings, identity, correlation, () => 1000)
  expect(result.account).toMatchObject({
    id: user.id,
    email,
    _verified: true,
    roles: ['superadmin'],
  })
  expect(credentialVersion(payload.secret, result.account)).toBe(
    credentialVersion(payload.secret, before),
  )
  expect(await findIdentityAccount(req, 'customers', 'google', identity.sub)).toBe(String(user.id))
  expect(req.transactionID).toBeUndefined()
  const after = await findNativeAccountById(req, 'customers', user.id)
  expect(after?.hash).toBe(before?.hash)
  expect(after?.salt).toBe(before?.salt)
  expect(after?.sessions).toEqual(before?.sessions)
})
