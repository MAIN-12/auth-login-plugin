import { methodPermitSecret } from '../../server/cutoverGeneration'
import { initializeMethodPermitLedger, consumeMethodPermit } from '../../server/methodPermitLedger'
import {
  authorizeGoogleAccount,
  authorizeGooglePrincipal,
  authorizeGoogleLink,
  authorizeGoogleReauthentication,
} from '../../domain/googleAccountPolicy'
import { sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { checkLoginPermission, type PayloadRequest } from 'payload'
import { AuthFailure } from '../../contracts/errors'
import type { GoogleCorrelation, GoogleIdentity } from '../../application/ports/google'
import type { PublicAuthConfig } from '../../../config'
import { credentialTransaction } from '../../server/passwordAdapter'
import { credentialVersion } from '../../server/credentialRequest'
import { createPasswordPermitCodec } from '../crypto/passwordPermitCodec'
import { type DrizzleDatabase } from '../../server/otpSession'
const table = 'auth_login_google_identities'
type User = NonNullable<PayloadRequest['user']>
export async function methodPermits(
  req: PayloadRequest,
  settings: PublicAuthConfig,
  now: () => number = Date.now,
) {
  const codec = createPasswordPermitCodec({
    now,
    secret: await methodPermitSecret(req, settings.collection),
    collection: settings.collection,
  })
  return { grant: codec.grant, readPermit: codec.read }
}
async function schema(db: DrizzleDatabase) {
  await db.execute({
    db: db.drizzle,
    raw: `CREATE TABLE IF NOT EXISTS ${table} (collection TEXT NOT NULL, subject TEXT NOT NULL, account TEXT NOT NULL, PRIMARY KEY (collection, subject), UNIQUE (collection, account))`,
  })
}
async function association(
  req: PayloadRequest,
  collection: string,
  subject: string,
  db: DrizzleDatabase,
) {
  const connection = req.transactionID
    ? db.sessions[String(await req.transactionID)].db
    : db.drizzle
  const result = (await db.execute({
    db: connection,
    sql: sql`SELECT account FROM auth_login_google_identities WHERE collection=${collection} AND subject=${subject}`,
  })) as { rows?: { account: string }[] }
  return result.rows?.[0]?.account
}
/** One account/identity commit boundary shares native credential and user row locks.
 * SQL uniqueness is authoritative across workers; matching email never grants an association.
 */
export async function resolveGoogleAccount(
  req: PayloadRequest,
  settings: PublicAuthConfig,
  identity: GoogleIdentity,
  correlation: GoogleCorrelation,
  now: () => number = Date.now,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
  assertCurrent?: () => Promise<void>,
) {
  const db = req.payload.db as unknown as DrizzleDatabase
  await schema(db)
  await initializeMethodPermitLedger(req)
  const original = req.user
  const associated = await association(req, settings.collection, identity.sub, db)
  let linked = associated
    ? await req.payload.db.findOne<User>({
        collection: settings.collection,
        req,
        where: { id: { equals: associated } },
      })
    : null
  const email = correlation.principal?.email ?? linked?.email ?? identity.email
  if (typeof email !== 'string' || !email) throw new AuthFailure('AUTH_FAILED', 401)
  try {
    return await credentialTransaction(req, settings.collection, email, async () => {
      await assertCurrent?.()
      const accountID = await association(req, settings.collection, identity.sub, db)
      linked = accountID
        ? await req.payload.db.findOne<User>({
            collection: settings.collection,
            req,
            where: { id: { equals: accountID } },
          })
        : null
      if (correlation.purpose !== 'login') {
        const principal = correlation.principal
        if (
          !principal ||
          !original ||
          original.id !== principal.id ||
          String(original._sid) !== principal.sid ||
          original.collection !== settings.collection
        )
          throw new AuthFailure('AUTH_FAILED', 401)
        const recheck = async () => {
          const account = await req.payload.db.findOne<User>({
            collection: settings.collection,
            req,
            where: { id: { equals: principal.id } },
          })
          if (req.user?.id !== principal.id || req.user.collection !== settings.collection)
            throw new AuthFailure('AUTH_FAILED', 401)
          authorizeGooglePrincipal({
            principal,
            current: account
              ? {
                  id: account.id,
                  sid: String(req.user?._sid),
                  version: credentialVersion(req.payload.secret, account),
                  email: String(account.email),
                  verified: account._verified === true,
                  deleted: Boolean(account.deletedAt),
                  sessionActive:
                    (account.sessions as { id: string; expiresAt: string }[])?.some(
                      (session) =>
                        session.id === principal.sid &&
                        new Date(session.expiresAt).getTime() > now(),
                    ) ?? false,
                }
              : null,
          })
          if (!account) throw new AuthFailure('AUTH_FAILED', 401)
          return account
        }
        const account = await recheck()
        checkLoginPermission({ req, user: account })
        if (correlation.purpose === 'reauth') {
          authorizeGoogleReauthentication(principal, linked?.id, identity, now())
          const permits = await methodPermits(req, settings, now)
          await assertCurrent?.()
          await recheck()
          return {
            account,
            permit: permits.grant({
              purpose: 'reauth',
              account: account.id,
              email: String(account.email),
              version: principal.version,
              sid: principal.sid,
            }),
          }
        }
        const permit = (await methodPermits(req, settings, now)).readPermit(
          'reauth',
          correlation.permit!,
        )
        authorizeGoogleLink(principal, permit, linked?.id)
        await consumeMethodPermit(req, permit, now)
        await db.execute({
          db: db.sessions[String(await req.transactionID)].db,
          sql: sql`INSERT INTO auth_login_google_identities (collection, subject, account) VALUES (${settings.collection}, ${identity.sub}, ${String(account.id)}) ON CONFLICT (collection, subject) DO NOTHING`,
        })
        if ((await association(req, settings.collection, identity.sub, db)) !== String(account.id))
          throw new AuthFailure('AUTH_FAILED', 401)
        await assertCurrent?.()
        await recheck()
        return { account }
      }
      const emailAccount =
        !linked && identity.email
          ? await req.payload.db.findOne({
              collection: settings.collection,
              req,
              where: { email: { equals: identity.email } },
            })
          : null
      authorizeGoogleAccount({
        purpose: 'login',
        signup: settings.allowSignup,
        linked: linked
          ? {
              id: linked.id,
              verified: linked._verified === true,
              deleted: Boolean(linked.deletedAt),
            }
          : null,
        emailAccountExists: Boolean(emailAccount),
        identity,
      })
      if (linked) {
        checkLoginPermission({ req, user: linked })
        await assertCurrent?.()
        return { account: linked }
      }
      const created = (await req.payload.create({
        collection: settings.collection,
        req,
        overrideAccess: true,
        disableVerificationEmail: true,
        data: {
          email: identity.email,
          password: randomBytes(32).toString('base64url'),
          _verified: true,
        },
      })) as User
      const account = await req.payload.db.findOne<User>({
        collection: settings.collection,
        req,
        where: { id: { equals: created.id } },
      })
      if (!account || account.email !== identity.email || account._verified !== true)
        throw new AuthFailure('AUTH_FAILED', 401)
      // Payload3.90 native registration requires a password. The discarded random
      // bootstrap credential is erased in this same transaction before any identity/session effect.
      await req.payload.db.updateOne({
        collection: settings.collection,
        id: account.id,
        req,
        data: { ...account, hash: null, salt: null },
        returning: false,
      })
      account.hash = null
      account.salt = null
      req.user = { ...account, collection: settings.collection }
      await assertPublicAccount?.(req)
      if (
        (await req.payload.collections[settings.collection].config.access.admin?.({ req })) !==
        false
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      await db.execute({
        db: db.sessions[String(await req.transactionID)].db,
        sql: sql`INSERT INTO auth_login_google_identities (collection, subject, account) VALUES (${settings.collection}, ${identity.sub}, ${String(account.id)})`,
      })
      await assertCurrent?.()
      const committed = await req.payload.db.findOne<User>({
        collection: settings.collection,
        req,
        where: { id: { equals: account.id } },
      })
      if (
        !committed ||
        committed.email !== identity.email ||
        committed._verified !== true ||
        committed.deletedAt ||
        committed.hash != null ||
        committed.salt != null ||
        (committed.sessions as unknown[] | undefined)?.length
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      return { account: committed }
    })
  } finally {
    req.user = original
  }
}
