import { setAuthenticationEvidence, type AuthenticationEvidence } from './adminPolicy'
import { randomUUID } from 'node:crypto'
import { createClient, type Config as SQLiteConfig } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { APIError, checkLoginPermission, getFieldsToSign, jwtSign, type Payload, type PayloadRequest } from 'payload'
import { credentialVersion, isCredentialRequest, isReauthenticationRequest } from './credentialRequest'
import { applyUserReadAccess } from 'payload/internal'

const provenRequests = new WeakMap<PayloadRequest, AuthenticationEvidence['method']>()
/** This proof is unforgeable by HTTP bodies or caller-controlled request context. */
export const isOtpSessionRequest = (req: PayloadRequest): boolean => provenRequests.get(req) === 'otp'
export const isProvenSessionRequest = (req: PayloadRequest): boolean => provenRequests.has(req)
type NativeUser = NonNullable<PayloadRequest['user']>
export interface DrizzleDatabase {
  name: string
  tableNameMap: Map<string, string>
  schemaName?: string
  clientConfig?: SQLiteConfig
  schema?: Record<string, unknown>
  sessions: Record<string, { db: unknown; reject: () => Promise<void>; resolve: () => Promise<void> }>
  drizzle: { transaction<T>(work: (tx: unknown) => Promise<T>, options?: unknown): Promise<T> }
  execute(args: { db: unknown; raw: string }): Promise<unknown>
}

/** OTP consumption commits before this adapter runs: failures burn proof rather than replay it.
 * Native user/session storage, hooks, read access and native signing remain authoritative.
 */
export async function createOtpSession(req: PayloadRequest, userID: string | number, collection: string, expectedEmail: string, expectedVersion?: string, proof: AuthenticationEvidence = { method: 'otp' }, assertOriginalAdminDenied?: (req: PayloadRequest) => Promise<void>) {
  const payload = req.payload
  const nativeCollection = payload.collections[collection]
  if (!nativeCollection || !nativeCollection.config.auth || !nativeCollection.config.auth.useSessions) throw new APIError('AUTH_FAILED', 401)
  const db = payload.db as unknown as DrizzleDatabase
  if (!['sqlite', 'postgres'].includes(db.name) || !db.drizzle?.transaction || !db.sessions || req.transactionID) throw new APIError('AUTH_FAILED', 401)
  const originalUser = req.user
  const config = nativeCollection.config
  const transactionID = randomUUID()
  provenRequests.set(req, proof.method)
  try {
    return await nativeTransaction(db, async tx => {
      db.sessions[transactionID] = { db: tx, reject: async () => { throw new APIError('AUTH_FAILED', 401) }, resolve: async () => { throw new APIError('AUTH_FAILED', 401) } }
      req.transactionID = transactionID
      try {
        // Lock before reading sessions; concurrent OTP logins must not overwrite each other.
        await lockUserRow(db, tx, collection, userID)
        const provenUser = await payload.db.findOne({ collection, req, where: { id: { equals: userID } }, select: { email: true } })
        if (!provenUser) throw new APIError('AUTH_FAILED', 401)
        let args = { collection: nativeCollection, data: { email: String((provenUser as { email?: string }).email), password: '' }, overrideAccess: false, req } as Parameters<typeof import('payload').loginOperation>[0]
        for (const hook of config.hooks.beforeOperation ?? []) {
          const changed = await hook({ args, collection: config, context: req.context, operation: 'login', overrideAccess: false, req })
          if (changed !== undefined) args = changed as typeof args
        }
        // Hooks cannot redirect the proven identity, collection, request or transaction.
        if (args.req !== req || args.collection !== nativeCollection || args.overrideAccess) throw new APIError('AUTH_FAILED', 401)
        const record = await payload.db.findOne({ collection, req, where: { id: { equals: userID } } }) as NativeUser | null
        if (expectedVersion !== undefined && credentialVersion(req.payload.secret, record) !== expectedVersion) throw new APIError('AUTH_FAILED', 401)
        if (!record || record.email !== expectedEmail || record.deletedAt || record._verified !== true) throw new APIError('AUTH_FAILED', 401)
        let user: NativeUser = record
        checkLoginPermission({ req, user })
        user.collection = collection
        user._strategy = 'local-jwt'
        const now = new Date()
        const sid = randomUUID()
        const sessions = ((user.sessions ?? []) as Array<{ id: string; createdAt: string | Date; expiresAt: string | Date }>).filter(session => new Date(session.expiresAt).getTime() > now.getTime())
        sessions.push({ id: sid, createdAt: now, expiresAt: new Date(now.getTime() + config.auth.tokenExpiration * 1000) })
        user.sessions = sessions
        // Payload's SQL array updater uses INSERT ... ON CONFLICT and needs required
        // user fields even for session-only updates. Exclude credentials entirely.
        const { hash: _hash, salt: _salt, password: _password, ...sessionData } = user
        await payload.db.updateOne({ collection, id: userID, req, data: { ...sessionData, sessions, ...(config.auth.maxLoginAttempts > 0 ? { loginAttempts: 0, lockUntil: null } : {}) }, returning: false })
        const fieldsToSign = { ...getFieldsToSign({ collectionConfig: config, email: String(user.email), sid, user }), authLoginMethod: proof.method, authAuthenticatedAt: proof.authenticatedAt, authAmr: proof.amr }
        user._sid = sid
        req.user = user
        user.authLoginMethod = proof.method
        setAuthenticationEvidence(req, proof)
        for (const hook of config.hooks.beforeLogin ?? []) user = await hook({ collection: config, context: req.context, req, user }) || user
        if (user.id !== userID || user.collection !== collection || user._verified !== true) throw new APIError('AUTH_FAILED', 401)
        checkLoginPermission({ req, user })
        const { exp, token } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration: config.auth.tokenExpiration })
        req.user = user
        user.authLoginMethod = proof.method
        setAuthenticationEvidence(req, proof)
        for (const hook of config.hooks.afterLogin ?? []) user = await hook({ collection: config, context: req.context, req, token, user }) || user
        if (user.id !== userID || user.collection !== collection || user._verified !== true) throw new APIError('AUTH_FAILED', 401)
        req.user = user
        setAuthenticationEvidence(req, proof)
        if (proof.method === 'otp') await assertOriginalAdminDenied?.(req)
        // Email OTP alone never authorizes Admin, even when the host defaults to all users.
        if (proof.method === 'otp' && (!config.access.admin || await config.access.admin({ req }) !== false)) throw new APIError('AUTH_FAILED', 401)
        const visibleUser = await applyUserReadAccess({ collection: config, overrideAccess: false, req, showHiddenFields: false, user })
        let result = { exp, token, user: visibleUser }
        for (const hook of config.hooks.afterOperation ?? []) {
          const changed = await hook({ args, collection: config, operation: 'login', overrideAccess: false, req, result })
          if (changed !== undefined) result = changed as typeof result
        }
        if (!result.token || result.user?.id !== userID) throw new APIError('AUTH_FAILED', 401)
        return result
      } finally {
        delete db.sessions[transactionID]
        delete req.transactionID
      }
    })
  } catch (error) {
    req.user = originalUser
    throw error
  } finally { provenRequests.delete(req) }
}

/** Resolve the native adapter table and lock the durable user before every session read/write. */
export async function lockUserRow(db: DrizzleDatabase, tx: unknown, collection: string, userID: string | number): Promise<void> {
  const normalized = collection.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  const tableName = db.tableNameMap.get(collection) ?? db.tableNameMap.get(normalized)
  if (!tableName) throw new APIError('AUTH_FAILED', 401)
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const table = db.name === 'postgres' && db.schemaName ? `${quote(db.schemaName)}.${quote(tableName)}` : quote(tableName)
  const id = `'${String(userID).replaceAll("'", "''")}'`
  await db.execute({ db: tx, raw: db.name === 'postgres' ? `SELECT id FROM ${table} WHERE id = ${id} FOR UPDATE` : `UPDATE ${table} SET id = id WHERE id = ${id}` })
}

/** Fresh SQLite connections isolate BUSY failures; never rerun authentication hooks. */
export async function nativeTransaction<T>(db: DrizzleDatabase, work: (tx: unknown) => Promise<T>): Promise<T> {
  if (db.name !== 'sqlite') return db.drizzle.transaction(work)
  if (!db.clientConfig || !db.schema) throw new APIError('AUTH_FAILED', 401)
  for (let attempt = 0; ; attempt++) {
    const client = createClient(db.clientConfig)
    let started = false
    try {
      const connection = drizzle(client, { schema: db.schema })
      return await connection.transaction(async tx => { started = true; return work(tx) })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (started || attempt >= 19 || (code !== 'SQLITE_BUSY' && code !== 'SQLITE_LOCKED')) throw error
    } finally { client.close() }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

type NativeSession = { id: string; createdAt: string | Date; expiresAt: string | Date }
const coordinated = new WeakMap<Payload, Set<string>>()
/** Apply only the session delta since this request's native read, under a fresh row lock.
 * A union would resurrect logout sessions; replacing would drop concurrent logins.
 */
export function installNativeSessionCoordination(payload: Payload, collection: string): void {
  const installed = coordinated.get(payload) ?? new Set<string>()
  if (installed.has(collection)) return
  installed.add(collection)
  coordinated.set(payload, installed)
  const db = payload.db as unknown as DrizzleDatabase
  if (!['sqlite', 'postgres'].includes(db.name)) throw new Error('OTP_STORAGE_UNAVAILABLE')
  const snapshots = new WeakMap<object, Map<string, NativeSession[]>>()
  const findOne = payload.db.findOne.bind(payload.db)
  const updateOne = payload.db.updateOne.bind(payload.db)
  const copy = (sessions: NativeSession[]) => sessions.map(session => ({ ...session }))
  const coordinateFind = async (args: Parameters<typeof payload.db.findOne>[0]) => {
    const result = await findOne<NativeUser>(args)
    if (args.collection === collection && args.req && result && Array.isArray(result.sessions)) {
      const records = snapshots.get(args.req) ?? new Map<string, NativeSession[]>()
      records.set(String(result.id), copy(result.sessions))
      snapshots.set(args.req, records)
    }
    return result
  }
  payload.db.findOne = coordinateFind as typeof payload.db.findOne
  const coordinateUpdate: typeof payload.db.updateOne = async args => {
    if (args.collection !== collection || !Array.isArray(args.data.sessions) || (args.req && isCredentialRequest(args.req as PayloadRequest))) return updateOne(args)
    const req = (args.req ?? { payload }) as PayloadRequest
    // Payload's auth operations use null updatedAt + returning:false. Ordinary
    // collection writes forcibly timestamp their cloned DB input; JSON fields
    // (_strategy/id/updatedAt) cannot manufacture this internal call boundary.
    const nativeAuthSnapshot = isProvenSessionRequest(req) || (args.returning === false && args.data.updatedAt === null)
    const incoming = args.data.sessions as NativeSession[]
    const resolvedID = args.id ?? args.data.id
    const identity = resolvedID === undefined ? await findOne({ collection, req, where: args.where }) : { id: resolvedID }
    if (!identity) throw new APIError('AUTH_FAILED', 401)
    const userID = identity.id as number | string
    const baseline = snapshots.get(req)?.get(String(userID))
    const perform = async (tx: unknown) => {
      await lockUserRow(db, tx, collection, userID)
      const current = await findOne<NativeUser>({ collection, req, where: { id: { equals: userID } } })
      if (!current) throw new APIError('AUTH_FAILED', 401)
      const latest = copy((current.sessions ?? []) as NativeSession[])
      const old = new Map((baseline ?? []).map(session => [session.id, session]))
      const requested = new Map(incoming.map(session => [session.id, session]))
      const removed = new Set((baseline ?? []).filter(session => !requested.has(session.id)).map(session => session.id))
      // An empty array from logout of the last observed session is still a delta,
      // not authority to erase sessions another request created after that read.
      // Revoke-all removes the observed baseline; concurrently created sessions
      // may survive as a legal logout-before-login ordering. No transport flags.
      let merged = baseline ? latest.filter(session => !removed.has(session.id)) : []
      for (const session of incoming) {
        const previous = old.get(session.id)
        const existing = merged.find(candidate => candidate.id === session.id)
        if (!previous) {
          if (!existing && !isReauthenticationRequest(req)) merged.push({ ...session })
        } else if (existing && new Date(previous.expiresAt).getTime() !== new Date(session.expiresAt).getTime()) {
          existing.expiresAt = session.expiresAt
        }
        // Old sessions removed since the baseline are never reintroduced.
      }
      const lifetime = payload.collections[collection].config.auth.tokenExpiration * 1000
      merged = merged.filter(session => {
        const expiry = Math.min(new Date(session.expiresAt).getTime(), new Date(session.createdAt).getTime() + lifetime)
        session.expiresAt = new Date(expiry)
        return Number.isFinite(expiry) && expiry > Date.now()
      })
      if (nativeAuthSnapshot && args.data.hash !== undefined && (args.data.hash !== current.hash || args.data.salt !== current.salt)) throw new APIError('AUTH_FAILED', 401)
      if (merged.some(session => !old.has(session.id)) || isReauthenticationRequest(req)) checkLoginPermission({ req, user: current })
      const { hash: _hash, salt: _salt, password: _password, ...fresh } = current
      // Native auth writes carry a full user snapshot; keep fresh non-session data.
      // Explicit application updates retain their supplied data and access semantics.
      const data = nativeAuthSnapshot ? { ...fresh, sessions: merged, updatedAt: null, ...(isProvenSessionRequest(req) ? { loginAttempts: args.data.loginAttempts, lockUntil: args.data.lockUntil } : {}) } : { ...fresh, ...args.data, sessions: merged }
      const { where: _where, ...writeArgs } = args
      const result = await updateOne({ ...writeArgs, id: userID, req, data })
      args.data.sessions = merged
      const records = snapshots.get(req) ?? new Map<string, NativeSession[]>()
      records.set(String(userID), copy(merged))
      snapshots.set(req, records)
      return result
    }
    const existingTransaction = req.transactionID ? await req.transactionID : undefined
    if (existingTransaction) {
      const transactionID = existingTransaction
      const session = db.sessions[transactionID]
      if (!session) throw new APIError('AUTH_FAILED', 401)
      return perform(session.db)
    }
    const transactionID = randomUUID()
    return nativeTransaction(db, async tx => {
      req.transactionID = transactionID
      db.sessions[transactionID] = { db: tx, reject: async () => { throw new APIError('AUTH_FAILED', 401) }, resolve: async () => { throw new APIError('AUTH_FAILED', 401) } }
      try { return await perform(tx) } finally { delete req.transactionID; delete db.sessions[transactionID] }
    })
  }
  payload.db.updateOne = async args => {
    if (args.collection !== collection || !Array.isArray(args.data.sessions) || (args.req && isCredentialRequest(args.req as PayloadRequest))) return updateOne(args)
    try { return await coordinateUpdate(args) } catch { throw new APIError('AUTH_UNAVAILABLE', 503) }
  }
}
