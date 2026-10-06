import { createHmac, randomUUID } from 'node:crypto'
import { checkLoginPermission, getFieldsToSign, jwtSign, loginOperation, type PayloadRequest } from 'payload'
import { AuthFailure } from '../domain/login'
import type { PasswordPermit } from '../domain/passwordLifecycle'
import { credentialVersion, credentialRequests, reauthenticationRequests } from './credentialRequest'
import { lockUserRow, nativeTransaction, type DrizzleDatabase } from './otpSession'

type User = NonNullable<PayloadRequest['user']>
type Session = { id: string; createdAt: string | Date; expiresAt: string | Date }
/** Only one native transaction can finalize credentials, revoke sessions and invalidate permits.
 * Row locks coordinate with native password/OTP session writes; hash-version proofs cannot survive reset.
 */
export async function credentialTransaction<T>(req: PayloadRequest, collection: string, email: string, work: () => Promise<T>): Promise<T> {
  const db = req.payload.db as unknown as DrizzleDatabase
  if (!['sqlite', 'postgres'].includes(db.name) || req.transactionID) throw new AuthFailure('AUTH_UNAVAILABLE', 503)
  const table = 'auth_login_credential_locks'
  await db.execute({ db: db.drizzle, raw: `CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY)` })
  const key = createHmac('sha256', req.payload.secret).update(JSON.stringify([collection, email])).digest('hex')
  return nativeTransaction(db, async tx => {
    await db.execute({ db: tx, raw: `INSERT INTO ${table} (key) VALUES ('${key}') ON CONFLICT (key) DO NOTHING` })
    if (db.name === 'postgres') await db.execute({ db: tx, raw: `SELECT key FROM ${table} WHERE key = '${key}' FOR UPDATE` })
    const id = randomUUID()
    db.sessions[id] = { db: tx, reject: async () => { throw new AuthFailure('AUTH_FAILED', 401) }, resolve: async () => { throw new AuthFailure('AUTH_FAILED', 401) } }
    req.transactionID = id
    credentialRequests.add(req)
    try {
      const account = await req.payload.db.findOne({ collection, req, where: { email: { equals: email } } })
      if (account) await lockUserRow(db, tx, collection, account.id)
      return await work()
    } finally { credentialRequests.delete(req); delete req.transactionID; delete db.sessions[id] }
  })
}
export async function commitPassword(req: PayloadRequest, collection: string, permit: PasswordPermit, password: string, now: () => number = Date.now): Promise<{ success: boolean; token?: string; exp?: number }> {
  const db = req.payload.db as unknown as DrizzleDatabase
  await db.execute({ db: db.drizzle, raw: 'CREATE TABLE IF NOT EXISTS auth_login_password_permits (key TEXT PRIMARY KEY, expires_at BIGINT NOT NULL)' })
  const originalUser = req.user
  try {
    return await credentialTransaction(req, collection, permit.email, async () => {
      if (!permit.nonce || !permit.expiresAt || permit.expiresAt <= now()) throw new AuthFailure('AUTH_FAILED', 401)
      const consumedKey = createHmac('sha256', req.payload.secret).update(permit.nonce).digest('hex')
      const tx = db.sessions[String(await req.transactionID)].db
      await db.execute({ db: tx, raw: `INSERT INTO auth_login_password_permits (key, expires_at) VALUES ('${consumedKey}', ${permit.expiresAt})` })
      const record = await req.payload.db.findOne({ collection, req, where: { email: { equals: permit.email } } }) as User | null
      if (permit.purpose === 'signup') {
        if (record || permit.account !== null) throw new AuthFailure('AUTH_FAILED', 401)
        const user = await req.payload.create({ collection, req, overrideAccess: true, disableVerificationEmail: true, data: { email: permit.email, password, _verified: true } })
        req.user = { ...user, collection } as User
        // Public registration can never create an admin-eligible principal via host defaults/hooks.
        if (await req.payload.collections[collection].config.access.admin?.({ req }) !== false) throw new AuthFailure('AUTH_FAILED', 401)
        return { success: true }
      }
      if (!record || record.id !== permit.account || credentialVersion(req.payload.secret, record) !== permit.version || record.deletedAt) throw new AuthFailure('AUTH_FAILED', 401)
      if (permit.purpose === 'recovery') {
        if (typeof record.hash !== 'string' || !record.hash || typeof record.salt !== 'string' || !record.salt) throw new AuthFailure('AUTH_FAILED', 401)
        // Ownership proof can establish previously unknown email verification, never infer it.
        await req.payload.update({ collection, id: record.id, req, overrideAccess: true, data: { password, _verified: true } })
        const fresh = await req.payload.db.findOne({ collection, req, where: { id: { equals: record.id } } })
        await req.payload.db.updateOne({ collection, id: record.id, req, data: { ...fresh, sessions: [] }, returning: false })
        return { success: true }
      }
      if (!originalUser || originalUser.collection !== collection || originalUser.id !== record.id || originalUser._sid !== permit.sid || record._verified !== true) throw new AuthFailure('AUTH_FAILED', 401)
      const session = (record.sessions as Session[] | undefined)?.find(session => session.id === permit.sid)
      const config = req.payload.collections[collection].config
      const cap = session ? Math.min(new Date(session.expiresAt).getTime(), new Date(session.createdAt).getTime() + config.auth.tokenExpiration * 1000) : NaN
      if (!session || !Number.isFinite(cap) || cap <= Date.now()) throw new AuthFailure('AUTH_FAILED', 401)
      checkLoginPermission({ req, user: record })
      await req.payload.update({ collection, id: record.id, req, overrideAccess: true, data: { password } })
      const fresh = await req.payload.db.findOne({ collection, req, where: { id: { equals: record.id } } }) as User
      const sid = randomUUID()
      await req.payload.db.updateOne({ collection, id: record.id, req, data: { ...fresh, sessions: [{ id: sid, createdAt: session.createdAt, expiresAt: new Date(cap) }] }, returning: false })
      const signed = await jwtSign({ fieldsToSign: { ...getFieldsToSign({ collectionConfig: config, email: permit.email, sid, user: fresh }), authLoginMethod: originalUser.authLoginMethod === 'otp' ? 'otp' : 'password' }, secret: req.payload.secret, tokenExpiration: Math.max(1, Math.floor((cap - Date.now()) / 1000)) })
      return { success: true, ...signed }
    })
  } finally { req.user = originalUser }
}

/** Uses native login permission/lockout/hooks. Native coordination suppresses the
 * new SID; even login-hook tokens are inert. No credential or application session is granted.
 */
export async function passwordReauthentication(req: PayloadRequest, collection: string, password: string): Promise<PasswordPermit> {
  const original = req.user
  if (!original || original.collection !== collection || !original._sid) throw new AuthFailure('UNAUTHENTICATED', 401)
  try {
    reauthenticationRequests.add(req)
    await loginOperation({ collection: req.payload.collections[collection], req, data: { email: String(original.email), password } })
    reauthenticationRequests.delete(req)
    req.user = original
    return await credentialTransaction(req, collection, String(original.email), async () => {
      const record = await req.payload.db.findOne({ collection, req, where: { id: { equals: original.id } } }) as User | null
      if (!record || !(record.sessions as Session[]).some(session => session.id === original._sid && new Date(session.expiresAt).getTime() > Date.now())) throw new AuthFailure('AUTH_FAILED', 401)
      return { purpose: 'reauth', email: String(record.email), account: record.id, version: credentialVersion(req.payload.secret, record), sid: String(original._sid) }
    })
  } finally { reauthenticationRequests.delete(req); req.user = original }
}
