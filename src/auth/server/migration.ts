import { randomBytes, randomUUID } from 'node:crypto'
import { createLocalReq, type Payload, type Where } from 'payload'
import { credentialRequests } from './credentialRequest'
import { cutoverTable, readCutoverGeneration, sqlLiteral } from './cutoverGeneration'
import { nativeTransaction, type DrizzleDatabase } from './otpSession'
export interface AuthLoginMigrationOptions {
  collection: string
  /** Operator attestation only: stop ALL instances/workers/writers before calling. */
  maintenance: true
  /** Explicit host inventory. An empty filter is safe only for a dedicated legacy collection. */
  legacyOtpCollection?: { slug: string; where: Where }
}
/** Offline operational API, not an HTTP endpoint. One native transaction preserves credentials
 * and verification evidence while revoking target sessions/codes/permits. Never restores authority.
 */
export async function migrateAuthLogin(payload: Payload, options: AuthLoginMigrationOptions) {
  const collection = payload.collections[options.collection]
  const db = payload.db as unknown as DrizzleDatabase
  if (options.maintenance !== true || !collection?.config.auth || !collection.config.auth.useSessions || !collection.config.auth.verify || !['sqlite', 'postgres'].includes(db.name)) throw new Error('auth-login: cutover requires maintenance and a supported native session/verification collection')
  if (options.legacyOtpCollection && (!payload.collections[options.legacyOtpCollection.slug] || options.legacyOtpCollection.slug === options.collection || !options.legacyOtpCollection.where || typeof options.legacyOtpCollection.where !== 'object' || Array.isArray(options.legacyOtpCollection.where))) throw new Error('auth-login: invalid explicit legacy OTP inventory')
  const req = await createLocalReq({}, payload)
  await readCutoverGeneration(req, options.collection)
  const generation = randomBytes(32).toString('hex')
  return nativeTransaction(db, async tx => {
    const transactionID = randomUUID()
    db.sessions[transactionID] = { db: tx, resolve: async () => {}, reject: async () => {} }
    req.transactionID = transactionID
    credentialRequests.add(req)
    try {
      const records = await payload.db.find<Record<string, unknown> & { id: string | number }>({ collection: options.collection, req, pagination: false, limit: 0 })
      for (const record of records.docs) {
        const { hash: _hash, salt: _salt, password: _password, ...data } = record
        // Native DB write deliberately bypasses host change hooks: migration may not rehash/provision.
        await payload.db.updateOne({ collection: options.collection, id: record.id, req, data: { ...data, sessions: [], resetPasswordToken: null, resetPasswordExpiration: null, _verificationToken: null }, returning: false })
      }
      let legacyCodesDeleted = 0
      if (options.legacyOtpCollection) {
        const { slug, where } = options.legacyOtpCollection
        const legacy = await payload.db.find({ collection: slug, req, where, pagination: false, limit: 0 })
        legacyCodesDeleted = legacy.docs.length
        await payload.db.deleteMany({ collection: slug, req, where })
      }
      await db.execute({ db: tx, raw: `INSERT INTO ${cutoverTable} (collection,generation) VALUES (${sqlLiteral(options.collection)},${sqlLiteral(generation)}) ON CONFLICT (collection) DO UPDATE SET generation=excluded.generation` })
      return { success: true as const, collection: options.collection, accounts: records.docs.length, legacyCodesDeleted, generation }
    } finally { credentialRequests.delete(req); delete req.transactionID; delete db.sessions[transactionID] }
  })
}
