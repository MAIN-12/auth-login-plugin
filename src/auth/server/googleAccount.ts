import { initializeMethodPermitLedger, consumeMethodPermit } from './methodPermitLedger'
import { authorizeGoogleAccount } from '../application/googleAccountPolicy'
import { randomBytes } from 'node:crypto'
import { checkLoginPermission, type PayloadRequest } from 'payload'
import { AuthFailure } from '../domain/login'
import type { GoogleCorrelation, GoogleIdentity } from '../application/googleFlow'
import type { PublicAuthConfig } from '../../config'
import { credentialTransaction } from './passwordAdapter'
import { credentialVersion } from './credentialRequest'
import { createPasswordLifecycle } from '../domain/passwordLifecycle'
import { type DrizzleDatabase } from './otpSession'
const table = 'auth_login_google_identities'
const quote = (value: string | number) => `'${String(value).replaceAll("'", "''")}'`
type User = NonNullable<PayloadRequest['user']>
export function methodPermits(req: PayloadRequest, settings: PublicAuthConfig, now: () => number = Date.now) {
  return createPasswordLifecycle({ now, secret: req.payload.secret, collection: settings.collection, signup: settings.allowSignup, recovery: settings.recovery, password: settings.passwordLogin, reauthentication: settings.googleOAuthEnabled || settings.passwordLogin || settings.otpLogin, commit: async () => { throw new AuthFailure('AUTH_FAILED', 401) } })
}
async function schema(db: DrizzleDatabase) { await db.execute({ db: db.drizzle, raw: `CREATE TABLE IF NOT EXISTS ${table} (collection TEXT NOT NULL, subject TEXT NOT NULL, account TEXT NOT NULL, PRIMARY KEY (collection, subject), UNIQUE (collection, account))` }) }
async function association(req: PayloadRequest, collection: string, subject: string, db: DrizzleDatabase) {
  const connection = req.transactionID ? db.sessions[String(await req.transactionID)].db : db.drizzle
  const result = await db.execute({ db: connection, raw: `SELECT account FROM ${table} WHERE collection=${quote(collection)} AND subject=${quote(subject)}` }) as { rows?: { account: string }[] }
  return result.rows?.[0]?.account
}
/** One account/identity commit boundary shares native credential and user row locks.
 * SQL uniqueness is authoritative across workers; matching email never grants an association.
 */
export async function resolveGoogleAccount(req: PayloadRequest, settings: PublicAuthConfig, identity: GoogleIdentity, correlation: GoogleCorrelation, now: () => number = Date.now, assertPublicAccount?: (req: PayloadRequest) => Promise<void>) {
  const db = req.payload.db as unknown as DrizzleDatabase
  await schema(db)
  await initializeMethodPermitLedger(req)
  const original = req.user
  const associated = await association(req, settings.collection, identity.sub, db)
  let linked = associated ? await req.payload.db.findOne<User>({ collection: settings.collection, req, where: { id: { equals: associated } } }) : null
  const email = correlation.principal?.email ?? linked?.email ?? identity.email
  if (typeof email !== 'string' || !email) throw new AuthFailure('AUTH_FAILED', 401)
  try {
    return await credentialTransaction(req, settings.collection, email, async () => {
      const accountID = await association(req, settings.collection, identity.sub, db)
      linked = accountID ? await req.payload.db.findOne<User>({ collection: settings.collection, req, where: { id: { equals: accountID } } }) : null
      if (correlation.purpose !== 'login') {
        const principal = correlation.principal
        if (!principal || !original || original.id !== principal.id || String(original._sid) !== principal.sid || original.collection !== settings.collection) throw new AuthFailure('AUTH_FAILED', 401)
        const account = await req.payload.db.findOne<User>({ collection: settings.collection, req, where: { id: { equals: principal.id } } })
        if (!account || account.deletedAt || account._verified !== true || credentialVersion(req.payload.secret, account) !== principal.version || !(account.sessions as { id: string; expiresAt: string }[])?.some(session => session.id === principal.sid && new Date(session.expiresAt).getTime() > Date.now())) throw new AuthFailure('AUTH_FAILED', 401)
        checkLoginPermission({ req, user: account })
        if (correlation.purpose === 'reauth') {
          if (!linked || String(linked.id) !== String(account.id) || identity.authenticatedAt === undefined || identity.authenticatedAt < now() - 300_000 || identity.authenticatedAt > now() + 30_000) throw new AuthFailure('AUTH_FAILED', 401)
          return { account, permit: methodPermits(req, settings, now).grant({ purpose: 'reauth', account: account.id, email: String(account.email), version: principal.version, sid: principal.sid }) }
        }
        const permit = methodPermits(req, settings, now).readPermit('reauth', correlation.permit!)
        if (permit.account !== account.id || permit.sid !== principal.sid || permit.email !== account.email || permit.version !== principal.version || !permit.nonce) throw new AuthFailure('AUTH_FAILED', 401)
        if (linked && String(linked.id) !== String(account.id)) throw new AuthFailure('AUTH_FAILED', 401)
        await consumeMethodPermit(req, permit, now)
        await db.execute({ db: db.sessions[String(await req.transactionID)].db, raw: `INSERT INTO ${table} (collection, subject, account) VALUES (${quote(settings.collection)}, ${quote(identity.sub)}, ${quote(account.id)}) ON CONFLICT (collection, subject) DO NOTHING` })
        if (await association(req, settings.collection, identity.sub, db) !== String(account.id)) throw new AuthFailure('AUTH_FAILED', 401)
        return { account }
      }
      const emailAccount = !linked && identity.email ? await req.payload.db.findOne({ collection: settings.collection, req, where: { email: { equals: identity.email } } }) : null
      authorizeGoogleAccount({ purpose: 'login', signup: settings.allowSignup, linked: linked ? { id: linked.id, verified: linked._verified === true, deleted: Boolean(linked.deletedAt) } : null, emailAccountExists: Boolean(emailAccount), identity })
      if (linked) {
        checkLoginPermission({ req, user: linked })
        return { account: linked }
      }
      const created = await req.payload.create({ collection: settings.collection, req, overrideAccess: true, disableVerificationEmail: true, data: { email: identity.email, password: randomBytes(32).toString('base64url'), _verified: true } }) as User
      const account = await req.payload.db.findOne<User>({ collection: settings.collection, req, where: { id: { equals: created.id } } })
      if (!account || account.email !== identity.email || account._verified !== true) throw new AuthFailure('AUTH_FAILED', 401)
      // Payload3.90 native registration requires a password. The discarded random
      // bootstrap credential is erased in this same transaction before any identity/session effect.
      await req.payload.db.updateOne({ collection: settings.collection, id: account.id, req, data: { ...account, hash: null, salt: null }, returning: false })
      account.hash = null; account.salt = null
      req.user = { ...account, collection: settings.collection }
      await assertPublicAccount?.(req)
      if (await req.payload.collections[settings.collection].config.access.admin?.({ req }) !== false) throw new AuthFailure('AUTH_FAILED', 401)
      await db.execute({ db: db.sessions[String(await req.transactionID)].db, raw: `INSERT INTO ${table} (collection, subject, account) VALUES (${quote(settings.collection)}, ${quote(identity.sub)}, ${quote(account.id)})` })
      return { account }
    })
  } finally { req.user = original }
}