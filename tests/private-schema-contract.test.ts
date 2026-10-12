import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Config } from 'payload'
import { authLoginPlugin } from '../src'
import * as publicApi from '../src'
import * as cutoverStorage from '../src/collections/AuthLoginCutovers'
import { authLoginCollections } from '../src/collections'

const options = {
  collection: 'customers',
  passwordLogin: true,
  otpLogin: false,
  allowSignup: false,
  recovery: false,
  providers: { google: false as const },
}
const target = { slug: 'customers', auth: { useSessions: true, verify: true }, fields: [] }
it('extends the configured auth collection and registers every required internal collection', async () => {
  const config = await authLoginPlugin(options)({ collections: [target] } as Config)
  expect(config.collections?.map(({ slug }) => slug)).toEqual([
    'customers',
    ...authLoginCollections.map(({ slug }) => slug),
  ])
  expect(authLoginCollections).toHaveLength(5)
  expect(config.collections?.some(({ slug }) => slug === 'ConfiguredAuthCollection')).toBe(false)
  const auth = config.collections?.[0]
  expect(auth?.auth).toMatchObject({ useSessions: true, verify: true })
  expect(auth?.hooks?.beforeChange).toHaveLength(1)
  for (const collection of config.collections!.slice(1)) {
    expect(collection).toMatchObject({
      endpoints: false,
      graphQL: false,
      timestamps: false,
      lockDocuments: false,
      admin: { hidden: true },
    })
    for (const access of Object.values(collection.access!))
      expect(await access({} as never)).toBe(false)
  }
})
it.each(
  authLoginCollections.flatMap(({ slug, dbName }) => [
    { slug, fields: [] },
    { slug: `collision-${slug}`, dbName, fields: [] },
    { slug: String(dbName), fields: [] },
  ]),
)('rejects reserved slug and table collisions: $slug', async (collection) => {
  await expect(
    authLoginPlugin(options)({ collections: [target, collection] } as Config),
  ).rejects.toThrow('reserved collection name')
})
it('disabled plugin does not add collections', async () => {
  const config = { collections: [target] } as Config
  expect(await authLoginPlugin({ enabled: false })(config)).toBe(config)
})
it('ships collection schema, not manual migrations or readiness APIs', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const exports of [manifest.exports, manifest.publishConfig.exports]) {
    expect(exports['./schema']).toBeUndefined()
    expect(exports['./migrations']).toBeUndefined()
  }
  expect(existsSync(new URL('../src/schema.ts', import.meta.url))).toBe(false)
  expect(existsSync(new URL('../src/auth', import.meta.url))).toBe(false)
  expect(manifest.files).not.toContain('tests')
})

it('stores provider-scoped identities in one shared collection', () => {
  const identities = authLoginCollections.find(({ slug }) => slug === 'auth-login-identities')
  expect(identities).toMatchObject({
    dbName: 'auth_login_identities',
    fields: [
      { name: 'collection', type: 'text', required: true },
      { name: 'provider', type: 'text', required: true },
      { name: 'subject', type: 'text', required: true },
      { name: 'account', type: 'text', required: true },
    ],
    indexes: [
      { fields: ['collection', 'provider', 'subject'], unique: true },
      { fields: ['collection', 'account', 'provider'], unique: true },
    ],
  })
  expect(authLoginCollections.some(({ slug }) => slug === 'auth-login-google-identities')).toBe(
    false,
  )
})

it('leaves data migration and bulk legacy cleanup outside the plugin', () => {
  expect(publicApi).not.toHaveProperty('migrateAuthLogin')
  expect(cutoverStorage).not.toHaveProperty('writeCutoverGeneration')
  expect(cutoverStorage.readCutoverGeneration).toBeTypeOf('function')
  const sourceFiles = (directory: URL): URL[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(entry.name) ? [file] : []
    })
  for (const file of sourceFiles(new URL('../src/', import.meta.url))) {
    const source = readFileSync(file, 'utf8')
    expect(source, file.pathname).not.toMatch(
      /migrateAuthLogin|createMaintenanceCommit|MaintenanceCommit|legacyOtpCollection|writeCutoverGeneration/,
    )
    expect(source, file.pathname).not.toMatch(/\b(?:deleteMany|updateMany)\s*\(/)
    expect(source, file.pathname).not.toMatch(/INSERT\s+INTO\s+auth_login_cutovers/i)
  }
})
