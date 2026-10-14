import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildConfig, createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { temporaryPostgres } from '../scripts/otp-postgres'
import { authLoginPlugin } from '../src'
import { authLoginCollections } from '../src/collections'
import { consumeMethodPermit } from '../src/collections/AuthLoginPasswordPermits'
import { insertIdentityAssociation } from '../src/collections/AuthLoginIdentities'
import { readCutoverGeneration } from '../src/collections/AuthLoginCutovers'
import {
  nativeTransaction,
  type DrizzleDatabase,
} from '../src/shared/infrastructure/payload/nativeTransaction'

// Real schema generation and upserts; no handwritten fixture provisioning.
for (const name of ['sqlite', 'postgres'] as const) {
  describe.skipIf(name === 'postgres' && process.env.AUTH_TEST_SCHEMA_POSTGRES !== '1')(
    `Payload-managed auth collections (${name})`,
    () => {
      let payload: Payload
      let adapter: DrizzleDatabase
      let directory: string
      let postgres: Awaited<ReturnType<typeof temporaryPostgres>> | undefined
      const query = async (raw: string) =>
        (await adapter.execute({ db: adapter.drizzle, raw })) as { rows: Record<string, unknown>[] }
      beforeAll(async () => {
        directory = await mkdtemp(join(tmpdir(), `auth-collections-${name}-`))
        if (name === 'postgres') postgres = await temporaryPostgres()
        const config = await buildConfig({
          secret: 'managed-collections-adapter-secret',
          telemetry: false,
          db:
            name === 'sqlite'
              ? sqliteAdapter({
                  client: { url: `file:${directory}/test.db` },
                  push: true,
                  migrationDir: join(directory, 'migrations'),
                })
              : postgresAdapter({
                  pool: { connectionString: postgres!.url },
                  push: true,
                  idType: 'uuid',
                  migrationDir: join(directory, 'migrations'),
                }),
          collections: [
            { slug: 'customers', auth: { useSessions: true, verify: true }, fields: [] },
          ],
          plugins: [
            authLoginPlugin({
              collection: 'customers',
              passwordLogin: true,
              otpLogin: false,
              allowSignup: false,
              recovery: false,
              providers: { google: false },
            }),
          ],
        })
        payload = await getPayload({ config, key: `collections-${name}-${directory}` })
        adapter = payload.db as unknown as DrizzleDatabase
      }, 60_000)
      afterAll(async () => {
        await payload?.destroy()
        if (name === 'postgres' && payload) {
          const pool = (
            payload.db as unknown as {
              pool: { _clients: { end(): Promise<void> }[]; end(): Promise<void> }
            }
          ).pool
          await Promise.all(pool._clients.map((client) => client.end()))
          void pool.end()
        }
        await postgres?.close()
        if (directory) await rm(directory, { recursive: true, force: true })
      })
      it('includes all five tables in generated schema without extra timestamp requirements', async () => {
        const db = payload.db as unknown as {
          rawTables: Record<string, { columns: Record<string, unknown> }>
        }
        for (const { dbName } of authLoginCollections) {
          expect(db.rawTables[String(dbName)]).toBeDefined()
          expect(db.rawTables[String(dbName)].columns).not.toHaveProperty('createdAt')
          expect(db.rawTables[String(dbName)].columns).not.toHaveProperty('updatedAt')
        }
      })
      it('generates consumer migration SQL and snapshot for all internal tables', async () => {
        await payload.db.createMigration({
          payload,
          migrationName: 'initial',
          forceAcceptWarning: true,
        })
        const files = await readdir(join(directory, 'migrations'))
        const migration = await readFile(
          join(
            directory,
            'migrations',
            files.find((file) => file.endsWith('_initial.ts'))!,
          ),
          'utf8',
        )
        const snapshot = await readFile(
          join(
            directory,
            'migrations',
            files.find((file) => file.endsWith('.json'))!,
          ),
          'utf8',
        )
        for (const { dbName } of authLoginCollections) {
          expect(migration).toContain(String(dbName))
          expect(snapshot).toContain(String(dbName))
        }
      })
      it('executes native upserts, unique arbitration and expiration writes with generated ids', async () => {
        await query(
          "INSERT INTO auth_login_otp_security (key,value) VALUES ('challenge',NULL) ON CONFLICT(key) DO NOTHING",
        )
        await query(
          "INSERT INTO auth_login_otp_security (key,value) VALUES ('challenge',NULL) ON CONFLICT(key) DO NOTHING",
        )
        await query("UPDATE auth_login_otp_security SET value='ciphertext' WHERE key='challenge'")
        await query(
          "INSERT INTO auth_login_credential_locks (key) VALUES ('lock') ON CONFLICT(key) DO NOTHING",
        )
        await query(
          "INSERT INTO auth_login_password_permits (key,expires_at) VALUES ('nonce',2000000000000)",
        )
        await expect(
          query(
            "INSERT INTO auth_login_password_permits (key,expires_at) VALUES ('nonce',2000000000000)",
          ),
        ).rejects.toThrow()
        await query(
          "INSERT INTO auth_login_cutovers (collection,generation) VALUES ('customers','old') ON CONFLICT(collection) DO UPDATE SET generation=excluded.generation",
        )
        await query(
          "INSERT INTO auth_login_cutovers (collection,generation) VALUES ('customers','new') ON CONFLICT(collection) DO UPDATE SET generation=excluded.generation",
        )
        await query(
          "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('customers','google','subject','account') ON CONFLICT(collection,provider,subject) DO NOTHING",
        )
        await query(
          "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('customers','google','subject','other') ON CONFLICT(collection,provider,subject) DO NOTHING",
        )
        await expect(
          query(
            "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('customers','google','another','account')",
          ),
        ).rejects.toThrow()
        for (const { dbName } of authLoginCollections) {
          const rows = (await query(`SELECT * FROM ${String(dbName)}`)).rows
          expect(rows).toHaveLength(1)
          expect(rows[0].id).toBeDefined()
        }
        expect((await query('SELECT generation FROM auth_login_cutovers')).rows[0].generation).toBe(
          'new',
        )
      })
      it('scopes both unique identity constraints to the provider and auth collection', async () => {
        await query(
          "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('members','google','shared','local')",
        )
        await query(
          "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('members','github','shared','local')",
        )
        await query(
          "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('staff','google','shared','local')",
        )
        await expect(
          query(
            "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('members','google','shared','rival')",
          ),
        ).rejects.toThrow()
        await expect(
          query(
            "INSERT INTO auth_login_identities (collection,provider,subject,account) VALUES ('members','google','other','local')",
          ),
        ).rejects.toThrow()
        await expect(
          query(
            "INSERT INTO auth_login_identities (collection,subject,account) VALUES ('members','missing-provider','other')",
          ),
        ).rejects.toThrow()
        expect(
          (
            await query(
              "SELECT provider FROM auth_login_identities WHERE collection='members' ORDER BY provider",
            )
          ).rows,
        ).toEqual([{ provider: 'github' }, { provider: 'google' }])
      })
      async function credentialWrite(work: (req: PayloadRequest) => Promise<void>) {
        const req = await createLocalReq({}, payload)
        return nativeTransaction(adapter, async (tx) => {
          const transactionID = 'fixture-native-api'
          adapter.sessions[transactionID] = {
            db: tx,
            resolve: async () => {},
            reject: async () => {},
          }
          req.transactionID = transactionID
          try {
            await work(req)
          } finally {
            delete req.transactionID
            delete adapter.sessions[transactionID]
          }
        })
      }
      it('Payload database creates and reads stay in the caller transaction and roll back', async () => {
        await expect(
          credentialWrite(async (req) => {
            await consumeMethodPermit(
              req,
              { nonce: 'rollback-api', expiresAt: 2000 } as Parameters<
                typeof consumeMethodPermit
              >[1],
              () => 1000,
            )
            await insertIdentityAssociation(
              req,
              'api-rollback',
              'google',
              "subject'quoted",
              'account',
            )
            expect(
              await payload.db.findOne({
                collection: 'auth-login-password-permits',
                req,
                where: { expires_at: { equals: 2000 } },
              }),
            ).toMatchObject({ id: expect.anything(), expires_at: 2000 })
            expect(
              await payload.db.findOne({
                collection: 'auth-login-identities',
                req,
                where: { collection: { equals: 'api-rollback' } },
              }),
            ).toMatchObject({ id: expect.anything(), subject: "subject'quoted" })
            await payload.db.create({
              collection: 'auth-login-cutovers',
              req,
              data: { collection: 'api-rollback', generation: 'c'.repeat(64) },
            })
            expect(await readCutoverGeneration(req, 'api-rollback')).toBe('c'.repeat(64))
            throw new Error('force caller rollback')
          }),
        ).rejects.toThrow('force caller rollback')
        expect(
          await payload.db.findOne({
            collection: 'auth-login-password-permits',
            where: { expires_at: { equals: 2000 } },
          }),
        ).toBeNull()
        expect(
          await payload.db.findOne({
            collection: 'auth-login-identities',
            where: { collection: { equals: 'api-rollback' } },
          }),
        ).toBeNull()
        expect(await readCutoverGeneration(await createLocalReq({}, payload), 'api-rollback')).toBe(
          '',
        )
      })
      it('Payload strict creates commit once and reject permit replay and both identity unique keys', async () => {
        const permit = { nonce: 'committed-api', expiresAt: 3000 } as Parameters<
          typeof consumeMethodPermit
        >[1]
        await credentialWrite(async (req) => {
          await consumeMethodPermit(req, permit, () => 1000)
          await insertIdentityAssociation(req, 'api-committed', 'google', 'subject', 'account')
        })
        for (const write of [
          (req: PayloadRequest) => consumeMethodPermit(req, permit, () => 1000),
          (req: PayloadRequest) =>
            insertIdentityAssociation(req, 'api-committed', 'google', 'subject', 'rival'),
          (req: PayloadRequest) =>
            insertIdentityAssociation(req, 'api-committed', 'google', 'other-subject', 'account'),
        ])
          await expect(credentialWrite(write)).rejects.toThrow()
        expect(
          await payload.db.findOne({
            collection: 'auth-login-identities',
            where: { collection: { equals: 'api-committed' } },
          }),
        ).toMatchObject({ account: 'account', subject: 'subject' })
      })
      it('denies ordinary Local API collection access', async () => {
        for (const { slug } of authLoginCollections) {
          await expect(
            payload.find({ collection: slug, overrideAccess: false }),
          ).rejects.toMatchObject({ status: 403 })
        }
      })
    },
  )
}
