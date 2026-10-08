import {
  beginReauthenticationEvidence,
  clearReauthenticationEvidence,
  readReauthenticationProof,
  sealReauthenticationEvidence,
  settleReauthenticationTransaction,
} from './reauthenticationEvidence'
import {
  beginCredentialIntent,
  clearCredentialIntent,
  assertCredentialIntent,
} from './credentialIntent'
import { initializeMethodPermitLedger, consumeMethodPermit } from './methodPermitLedger'
import { createHmac, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import {
  checkLoginPermission,
  getFieldsToSign,
  jwtSign,
  loginOperation,
  type PayloadRequest,
} from 'payload'
import { AuthFailure } from '../domain/login'
import type { PasswordPermit } from '../domain/passwordLifecycle'
import {
  credentialVersion,
  credentialRequests,
  reauthenticationRequests,
} from './credentialRequest'
import { lockUserRow, nativeTransaction, type DrizzleDatabase } from './otpSession'

type User = NonNullable<PayloadRequest['user']>
type Session = { id: string; createdAt: string | Date; expiresAt: string | Date }
/** Only one native transaction can finalize credentials, revoke sessions and invalidate permits.
 * Row locks coordinate with native password/OTP session writes; hash-version proofs cannot survive reset.
 */
export async function credentialTransaction<T>(
  req: PayloadRequest,
  collection: string,
  email: string,
  work: () => Promise<T>,
): Promise<T> {
  const db = req.payload.db as unknown as DrizzleDatabase
  if (!['sqlite', 'postgres'].includes(db.name) || req.transactionID)
    throw new AuthFailure('AUTH_UNAVAILABLE', 503)
  const table = 'auth_login_credential_locks'
  await db.execute({
    db: db.drizzle,
    raw: `CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY)`,
  })
  const key = createHmac('sha256', req.payload.secret)
    .update(JSON.stringify([collection, email]))
    .digest('hex')
  return nativeTransaction(db, async (tx) => {
    await db.execute({
      db: tx,
      sql: sql`INSERT INTO auth_login_credential_locks (key) VALUES (${key}) ON CONFLICT (key) DO NOTHING`,
    })
    if (db.name === 'postgres')
      await db.execute({
        db: tx,
        sql: sql`SELECT key FROM auth_login_credential_locks WHERE key = ${key} FOR UPDATE`,
      })
    const id = randomUUID()
    db.sessions[id] = {
      db: tx,
      reject: async () => {
        throw new AuthFailure('AUTH_FAILED', 401)
      },
      resolve: async () => {
        throw new AuthFailure('AUTH_FAILED', 401)
      },
    }
    req.transactionID = id
    credentialRequests.add(req)
    try {
      const account = await req.payload.db.findOne({
        collection,
        req,
        where: { email: { equals: email } },
      })
      if (account) await lockUserRow(db, tx, collection, account.id)
      return await work()
    } finally {
      credentialRequests.delete(req)
      delete req.transactionID
      delete db.sessions[id]
    }
  })
}
export async function commitPassword(
  req: PayloadRequest,
  collection: string,
  permit: PasswordPermit,
  password: string,
  now: () => number = Date.now,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
  assertCurrent?: () => Promise<void>,
): Promise<{ success: boolean; token?: string; exp?: number }> {
  await initializeMethodPermitLedger(req)
  const originalUser = req.user
  try {
    return await credentialTransaction(req, collection, permit.email, async () => {
      await assertCurrent?.()
      await consumeMethodPermit(req, permit, now)
      const record = (await req.payload.db.findOne({
        collection,
        req,
        where: { email: { equals: permit.email } },
      })) as User | null
      if (permit.purpose === 'signup') {
        if (record || permit.account !== null) throw new AuthFailure('AUTH_FAILED', 401)
        beginCredentialIntent(req, permit.email, password)
        const user = await req.payload.create({
          collection,
          req,
          overrideAccess: true,
          disableVerificationEmail: true,
          data: { email: permit.email, password, _verified: true },
        })
        const native = await req.payload.db.findOne<User>({
          collection,
          req,
          where: { id: { equals: user.id } },
        })
        assertCredentialIntent(req, native, user.id)
        if (!native) throw new AuthFailure('AUTH_FAILED', 401)
        req.user = { ...native, collection } as User
        await assertPublicAccount?.(req)
        // Public registration can never create an admin-eligible principal via host defaults/hooks.
        if ((await req.payload.collections[collection].config.access.admin?.({ req })) !== false)
          throw new AuthFailure('AUTH_FAILED', 401)
        await assertCurrent?.()
        return { success: true }
      }
      if (
        !record ||
        record.id !== permit.account ||
        credentialVersion(req.payload.secret, record) !== permit.version ||
        record.deletedAt
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      if (permit.purpose === 'recovery') {
        if (
          typeof record.hash !== 'string' ||
          !record.hash ||
          typeof record.salt !== 'string' ||
          !record.salt
        )
          throw new AuthFailure('AUTH_FAILED', 401)
        beginCredentialIntent(req, permit.email, password)
        // Ownership proof can establish previously unknown email verification, never infer it.
        await req.payload.update({
          collection,
          id: record.id,
          req,
          overrideAccess: true,
          data: { password, _verified: true },
        })
        const fresh = await req.payload.db.findOne({
          collection,
          req,
          where: { id: { equals: record.id } },
        })
        assertCredentialIntent(req, fresh, record.id)
        await req.payload.db.updateOne({
          collection,
          id: record.id,
          req,
          data: { ...fresh, sessions: [] },
          returning: false,
        })
        await assertCurrent?.()
        return { success: true }
      }
      if (
        !originalUser ||
        originalUser.collection !== collection ||
        originalUser.id !== record.id ||
        originalUser._sid !== permit.sid ||
        record._verified !== true
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      const session = (record.sessions as Session[] | undefined)?.find(
        (session) => session.id === permit.sid,
      )
      const config = req.payload.collections[collection].config
      const cap = session
        ? Math.min(
            new Date(session.expiresAt).getTime(),
            new Date(session.createdAt).getTime() + config.auth.tokenExpiration * 1000,
          )
        : NaN
      if (!session || !Number.isFinite(cap) || cap <= Date.now())
        throw new AuthFailure('AUTH_FAILED', 401)
      checkLoginPermission({ req, user: record })
      beginCredentialIntent(req, permit.email, password)
      await req.payload.update({
        collection,
        id: record.id,
        req,
        overrideAccess: true,
        data: { password },
      })
      const fresh = (await req.payload.db.findOne({
        collection,
        req,
        where: { id: { equals: record.id } },
      })) as User
      assertCredentialIntent(req, fresh, record.id)
      const sid = randomUUID()
      await req.payload.db.updateOne({
        collection,
        id: record.id,
        req,
        data: {
          ...fresh,
          sessions: [{ id: sid, createdAt: session.createdAt, expiresAt: new Date(cap) }],
        },
        returning: false,
      })
      const signed = await jwtSign({
        fieldsToSign: {
          ...getFieldsToSign({ collectionConfig: config, email: permit.email, sid, user: fresh }),
          authLoginMethod:
            originalUser.authLoginMethod === 'otp'
              ? 'otp'
              : originalUser.authLoginMethod === 'google'
                ? 'google'
                : 'password',
          authAuthenticatedAt:
            typeof originalUser.authAuthenticatedAt === 'number'
              ? originalUser.authAuthenticatedAt
              : undefined,
          authAmr: Array.isArray(originalUser.authAmr) ? originalUser.authAmr : undefined,
        },
        secret: req.payload.secret,
        tokenExpiration: Math.max(1, Math.floor((cap - Date.now()) / 1000)),
      })
      await assertCurrent?.()
      return { success: true, ...signed }
    })
  } finally {
    clearCredentialIntent(req)
    req.user = originalUser
  }
}

/** Uses native login permission/lockout/hooks. Native coordination suppresses the
 * new SID; even login-hook tokens are inert. No credential or application session is granted.
 */
export async function passwordReauthentication(
  req: PayloadRequest,
  collection: string,
  password: string,
): Promise<PasswordPermit> {
  const original = req.user
  if (!original || original.collection !== collection || !original._sid)
    throw new AuthFailure('UNAUTHENTICATED', 401)
  if (req.transactionID) throw new AuthFailure('AUTH_UNAVAILABLE', 503)
  const before = await req.payload.db.findOne<User>({
    collection,
    req,
    where: { id: { equals: original.id } },
  })
  if (
    !before ||
    before.email !== original.email ||
    before._verified !== true ||
    before.deletedAt ||
    typeof before.hash !== 'string' ||
    !before.hash ||
    typeof before.salt !== 'string' ||
    !before.salt
  )
    throw new AuthFailure('AUTH_FAILED', 401)
  beginReauthenticationEvidence(req, collection, original, before)
  let proof: PasswordPermit | undefined
  const nativeCollection = req.payload.collections[collection]
  const guardedCollection = {
    ...nativeCollection,
    config: {
      ...nativeCollection.config,
      hooks: {
        ...nativeCollection.config.hooks,
        beforeOperation: [
          ...(nativeCollection.config.hooks?.beforeOperation ?? []),
          (
            args: Parameters<
              NonNullable<typeof nativeCollection.config.hooks.beforeOperation>[number]
            >[0],
          ) => {
            const nativeArgs = args.args as Parameters<typeof loginOperation>[0]
            if (
              nativeArgs.req !== req ||
              nativeArgs.collection !== guardedCollection ||
              nativeArgs.data.email !== original.email ||
              nativeArgs.data.password !== password
            )
              throw new AuthFailure('AUTH_FAILED', 401)
            return args.args
          },
        ],
        beforeLogin: [
          ({
            req: nativeReq,
            user,
          }: Parameters<
            NonNullable<typeof nativeCollection.config.hooks.beforeLogin>[number]
          >[0]) => {
            if (nativeReq !== req) throw new AuthFailure('AUTH_FAILED', 401)
            sealReauthenticationEvidence(req)
            return user
          },
          ...(nativeCollection.config.hooks?.beforeLogin ?? []),
        ],
        afterOperation: [
          ...(nativeCollection.config.hooks?.afterOperation ?? []),
          async (
            args: Parameters<
              NonNullable<typeof nativeCollection.config.hooks.afterOperation>[number]
            >[0],
          ) => {
            if (args.operation !== 'login' || args.req !== req)
              throw new AuthFailure('AUTH_FAILED', 401)
            proof = await readReauthenticationProof(req, (args.result as { user?: User }).user)
            return args.result
          },
        ],
      },
    },
  }
  try {
    reauthenticationRequests.add(req)
    await loginOperation({
      collection: guardedCollection,
      req,
      data: { email: String(original.email), password },
    })
    if (!proof) throw new AuthFailure('AUTH_FAILED', 401)
    await settleReauthenticationTransaction(req)
    return proof
  } catch (error) {
    try {
      await settleReauthenticationTransaction(req, error)
    } catch {
      /* Preserve the native failure. */
    }
    throw error
  } finally {
    clearReauthenticationEvidence(req)
    reauthenticationRequests.delete(req)
    req.user = original
  }
}

/** Email proof establishes only verification; no password, permit or session is issued.
 * The already-consumed challenge is burnt if hooks/policy/native commit fail.
 */
export async function commitEmailVerification(
  req: PayloadRequest,
  collection: string,
  proof: import('../application/ownershipVerification').OwnershipProof,
  assertPublicAccount?: (req: PayloadRequest) => Promise<void>,
  assertCurrent?: () => Promise<void>,
) {
  const original = req.user
  try {
    return await credentialTransaction(req, collection, proof.email, async () => {
      await assertCurrent?.()
      const record = await req.payload.db.findOne<User>({
        collection,
        req,
        where: { email: { equals: proof.email } },
      })
      if (
        proof.purpose !== 'verify-email' ||
        !record ||
        record.id !== proof.account ||
        record.deletedAt ||
        record._verified === true ||
        credentialVersion(req.payload.secret, record) !== proof.version
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      req.user = { ...record, collection } as User
      // Email-only proof never changes administrative eligibility.
      if (!assertPublicAccount) throw new AuthFailure('AUTH_FAILED', 401)
      await assertPublicAccount(req)
      await req.payload.update({
        collection,
        id: record.id,
        req,
        overrideAccess: true,
        data: { _verified: true },
      })
      const fresh = await req.payload.db.findOne<User>({
        collection,
        req,
        where: { id: { equals: record.id } },
      })
      if (
        !fresh ||
        fresh.email !== record.email ||
        fresh._verified !== true ||
        fresh.hash !== record.hash ||
        fresh.salt !== record.salt ||
        JSON.stringify(fresh.sessions ?? []) !== JSON.stringify(record.sessions ?? [])
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      req.user = { ...fresh, collection } as User
      await assertPublicAccount(req)
      await assertCurrent?.()
      return { success: true as const }
    })
  } finally {
    req.user = original
  }
}

/** Issuing authority requires a fresh native decision under the same credential locks as completion. */
export async function grantOwnershipPermit<T>(
  req: PayloadRequest,
  collection: string,
  proof: PasswordPermit,
  issue: () => Promise<T>,
  assertCurrent?: () => Promise<void>,
): Promise<T> {
  return credentialTransaction(req, collection, proof.email, async () => {
    await assertCurrent?.()
    const record = await req.payload.db.findOne<User>({
      collection,
      req,
      where: { email: { equals: proof.email } },
    })
    if (proof.purpose === 'signup') {
      if (record || proof.account !== null || proof.version !== '')
        throw new AuthFailure('AUTH_FAILED', 401)
    } else {
      if (
        !record ||
        record.id !== proof.account ||
        record.email !== proof.email ||
        record.deletedAt ||
        credentialVersion(req.payload.secret, record) !== proof.version
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      if (
        proof.purpose === 'recovery' &&
        (typeof record.hash !== 'string' ||
          !record.hash ||
          typeof record.salt !== 'string' ||
          !record.salt)
      )
        throw new AuthFailure('AUTH_FAILED', 401)
      if (
        proof.purpose === 'reauth' &&
        (req.user?.collection !== collection ||
          req.user.id !== record.id ||
          req.user._sid !== proof.sid ||
          record._verified !== true ||
          !(record.sessions as Session[] | undefined)?.some(
            (session) =>
              session.id === proof.sid && new Date(session.expiresAt).getTime() > Date.now(),
          ))
      )
        throw new AuthFailure('AUTH_FAILED', 401)
    }
    const result = await issue()
    await assertCurrent?.()
    return result
  })
}
