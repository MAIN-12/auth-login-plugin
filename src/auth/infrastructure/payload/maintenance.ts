import { randomBytes, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createLocalReq, type Payload, type Where } from 'payload'
import type { MaintenanceCommit } from '../../application/ports/maintenance'
import { credentialRequests } from '../../server/credentialRequest'
import { readCutoverGeneration } from '../../server/cutoverGeneration'
import { nativeTransaction, type DrizzleDatabase } from '../../server/otpSession'

/** Keeps the entire cutover in the existing native transaction, including rollback/finally. */
export function createMaintenanceCommit(payload: Payload, legacyWhere?: Where): MaintenanceCommit {
  return {
    async commit(options) {
      const collection = payload.collections[options.collection]
      const db = payload.db as unknown as DrizzleDatabase
      if (
        !collection?.config.auth ||
        !collection.config.auth.useSessions ||
        !collection.config.auth.verify ||
        !['sqlite', 'postgres'].includes(db.name)
      )
        throw new Error(
          'auth-login: cutover requires maintenance and a supported native session/verification collection',
        )
      if (options.legacyOtpCollection && !payload.collections[options.legacyOtpCollection.slug])
        throw new Error('auth-login: invalid explicit legacy OTP inventory')
      const req = await createLocalReq({}, payload)
      await readCutoverGeneration(req, options.collection)
      const generation = randomBytes(32).toString('hex')
      return nativeTransaction(db, async (tx) => {
        const transactionID = randomUUID()
        db.sessions[transactionID] = { db: tx, resolve: async () => {}, reject: async () => {} }
        req.transactionID = transactionID
        credentialRequests.add(req)
        try {
          const records = await payload.db.find<Record<string, unknown> & { id: string | number }>({
            collection: options.collection,
            req,
            pagination: false,
            limit: 0,
          })
          for (const record of records.docs) {
            const { hash: _hash, salt: _salt, password: _password, ...data } = record
            // Native DB write deliberately bypasses host change hooks: migration may not rehash/provision.
            await payload.db.updateOne({
              collection: options.collection,
              id: record.id,
              req,
              data: {
                ...data,
                sessions: [],
                resetPasswordToken: null,
                resetPasswordExpiration: null,
                _verificationToken: null,
              },
              returning: false,
            })
          }
          let legacyCodesDeleted = 0
          if (options.legacyOtpCollection) {
            const { slug } = options.legacyOtpCollection
            const where = legacyWhere!
            const legacy = await payload.db.find({
              collection: slug,
              req,
              where,
              pagination: false,
              limit: 0,
            })
            legacyCodesDeleted = legacy.docs.length
            await payload.db.deleteMany({ collection: slug, req, where })
          }
          await db.execute({
            db: tx,
            sql: sql`INSERT INTO auth_login_cutovers (collection,generation) VALUES (${options.collection},${generation}) ON CONFLICT (collection) DO UPDATE SET generation=excluded.generation`,
          })
          return {
            success: true as const,
            collection: options.collection,
            accounts: records.docs.length,
            legacyCodesDeleted,
            generation,
          }
        } finally {
          credentialRequests.delete(req)
          delete req.transactionID
          delete db.sessions[transactionID]
        }
      })
    },
  }
}
