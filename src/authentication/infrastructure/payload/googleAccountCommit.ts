import {
  clearProviderAccountPassword,
  createVerifiedPasswordAccount,
} from '../../../collections/ConfiguredAuthCollection/index'
import {
  findNativeAccountById,
  findNativeAccountByEmail,
} from '../../../collections/ConfiguredAuthCollection/index'
import {
  findIdentityAccount,
  insertIdentityAssociation,
  associateIdentityIfAbsent,
} from '../../../collections/AuthLoginIdentities/index'
import { methodPermitSecret } from '../crypto/methodPermitSecret'
import { consumeMethodPermit } from '../../../collections/AuthLoginPasswordPermits/index'
import {
  authorizeGoogleAccount,
  authorizeGooglePrincipal,
  authorizeGoogleLink,
  authorizeGoogleReauthentication,
} from '../../domain'
import { randomBytes } from 'node:crypto'
import { APIError, checkLoginPermission, type PayloadRequest } from 'payload'
import { AuthFailure } from '../../../shared/contracts/errors'
import type { GoogleCorrelation, GoogleIdentity } from '../../application'
import type { PublicAuthConfig } from '../../../configuration/plugin/config'
import { credentialTransaction } from '../../../collections/ConfiguredAuthCollection/index'
import { credentialVersion } from '../../../collections/ConfiguredAuthCollection/index'
import { createPasswordPermitCodec } from '../../../collections/AuthLoginPasswordPermits/index'
import { type DrizzleDatabase } from '../../../shared/infrastructure/payload/nativeTransaction'
/** Preserve native lockout/verification checks, but never expose native error text. */
function checkAccountLoginPermission(input: Parameters<typeof checkLoginPermission>[0]) {
  try {
    checkLoginPermission(input)
  } catch (error) {
    if (error instanceof APIError && [400, 401, 403].includes(error.status))
      throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_LOGIN_DENIED')
    throw error
  }
}
type User = NonNullable<PayloadRequest['user']>

/** TEMPORARY [DEBUG-google-association]: local IDs only; never stringify unknown objects. */
function safeDiagnosticID(value: unknown): string | number | undefined {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
    ? value
    : undefined
}
function associationSnapshot(
  phase: 'initial' | 'locked' | 'post-association',
  association: unknown,
  account: User | null,
) {
  const expected = account?.id
  const expectedID = safeDiagnosticID(expected)
  const observedID = safeDiagnosticID(association)
  const primitiveExpected = typeof expected === 'string' || typeof expected === 'number'
  const primitiveObserved = typeof association === 'string' || typeof association === 'number'
  return {
    phase,
    associationFound: association !== undefined,
    associationAccountType: association === null ? 'null' : typeof association,
    nativeAccountFound: account != null,
    nativeAccountIdType: expected === null ? 'null' : typeof expected,
    ...(expectedID === undefined ? {} : { expectedAccountId: expectedID }),
    ...(observedID === undefined ? {} : { observedAssociationAccount: observedID }),
    matchesExpected: primitiveExpected && association === String(expected),
    matchesAfterStringConversion:
      primitiveExpected && primitiveObserved && String(association) === String(expected),
  }
}
function logAssociationConflict(
  req: PayloadRequest,
  lookups: ReturnType<typeof associationSnapshot>[],
) {
  try {
    req.payload.logger?.info?.({ event: '[DEBUG-google-association]', lookups })
  } catch {
    // TEMPORARY [DEBUG-google-association]: probes cannot change rejection or rollback.
  }
}
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

/** One account/identity commit boundary shares native credential and user row locks.
 * SQL uniqueness is authoritative across workers; email association requires Google authority.
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
  const original = req.user
  const associated = await findIdentityAccount(req, settings.collection, 'google', identity.sub)
  let linked = associated
    ? await findNativeAccountById<User>(req, settings.collection, associated)
    : null
  const initialLookup = associationSnapshot('initial', associated, linked)
  const email = correlation.principal?.email ?? linked?.email ?? identity.email
  if (typeof email !== 'string' || !email)
    throw new AuthFailure('AUTH_FAILED', 401, 'GOOGLE_IDENTITY_REJECTED')
  try {
    return await credentialTransaction(req, settings.collection, email, async () => {
      await assertCurrent?.()
      const accountID = await findIdentityAccount(req, settings.collection, 'google', identity.sub)
      linked = accountID
        ? await findNativeAccountById<User>(req, settings.collection, accountID)
        : null
      const lockedLookup = associationSnapshot('locked', accountID, linked)
      if (correlation.purpose !== 'login') {
        const principal = correlation.principal
        if (
          !principal ||
          !original ||
          original.id !== principal.id ||
          String(original._sid) !== principal.sid ||
          original.collection !== settings.collection
        )
          throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_STATE_CHANGED')
        const recheck = async () => {
          const account = await findNativeAccountById<User>(req, settings.collection, principal.id)
          if (req.user?.id !== principal.id || req.user.collection !== settings.collection)
            throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_STATE_CHANGED')
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
          if (!account) throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_STATE_CHANGED')
          return account
        }
        const account = await recheck()
        checkAccountLoginPermission({ req, user: account })
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
        await associateIdentityIfAbsent(
          req,
          settings.collection,
          'google',
          identity.sub,
          String(account.id),
          db,
        )
        if (
          (await findIdentityAccount(req, settings.collection, 'google', identity.sub)) !==
          String(account.id)
        )
          throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_STATE_CHANGED')
        await assertCurrent?.()
        await recheck()
        return { account }
      }
      const emailAccount =
        !linked && identity.email
          ? await findNativeAccountByEmail(req, settings.collection, identity.email)
          : null
      const decision = authorizeGoogleAccount({
        purpose: 'login',
        signup: settings.allowSignup,
        linked: linked
          ? {
              id: linked.id,
              verified: linked._verified === true,
              deleted: Boolean(linked.deletedAt),
            }
          : null,
        emailAccount: emailAccount
          ? {
              id: emailAccount.id,
              verified: emailAccount._verified === true,
              deleted: Boolean(emailAccount.deletedAt),
            }
          : null,
        identity,
      })
      if (linked) {
        checkAccountLoginPermission({ req, user: linked })
        await assertCurrent?.()
        return { account: linked }
      }
      if (decision === 'associate' && emailAccount) {
        checkAccountLoginPermission({ req, user: emailAccount })
        const version = credentialVersion(req.payload.secret, emailAccount)
        await associateIdentityIfAbsent(
          req,
          settings.collection,
          'google',
          identity.sub,
          String(emailAccount.id),
          db,
        )
        await assertCurrent?.()
        const committed = await findNativeAccountById<User>(
          req,
          settings.collection,
          emailAccount.id,
        )
        if (!committed) throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_NOT_FOUND')
        if (committed.email !== identity.email)
          throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_EMAIL_CHANGED')
        if (committed.deletedAt) throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_UNAVAILABLE')
        if (committed._verified !== true)
          throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_NOT_VERIFIED')
        if (credentialVersion(req.payload.secret, committed) !== version)
          throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_CREDENTIALS_CHANGED')
        const committedAssociation = await findIdentityAccount(
          req,
          settings.collection,
          'google',
          identity.sub,
        )
        if (committedAssociation !== String(emailAccount.id)) {
          if (committedAssociation !== undefined)
            logAssociationConflict(req, [
              initialLookup,
              lockedLookup,
              associationSnapshot('post-association', committedAssociation, committed),
            ])
          throw new AuthFailure(
            'AUTH_FAILED',
            401,
            committedAssociation === undefined
              ? 'GOOGLE_ASSOCIATION_NOT_PERSISTED'
              : 'GOOGLE_ASSOCIATION_CONFLICT',
          )
        }
        checkAccountLoginPermission({ req, user: committed })
        return { account: committed }
      }
      const created = (await createVerifiedPasswordAccount(
        req,
        settings.collection,
        identity.email,
        randomBytes(32).toString('base64url'),
      )) as User
      const account = await findNativeAccountById<User>(req, settings.collection, created.id)
      if (!account) throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_NOT_FOUND')
      if (account.email !== identity.email)
        throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_EMAIL_CHANGED')
      if (account._verified !== true)
        throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_NOT_VERIFIED')
      // Payload3.90 native registration requires a password. The discarded random
      // bootstrap credential is erased in this same transaction before any identity/session effect.
      await clearProviderAccountPassword(req, settings.collection, account)
      account.hash = null
      account.salt = null
      req.user = { ...account, collection: settings.collection }
      await assertPublicAccount?.(req)
      if (
        (await req.payload.collections[settings.collection].config.access.admin?.({ req })) !==
        false
      )
        throw new AuthFailure('AUTH_FAILED', 401, 'PUBLIC_ACCOUNT_PRIVILEGE_DENIED')
      await insertIdentityAssociation(
        req,
        settings.collection,
        'google',
        identity.sub,
        String(account.id),
      )
      await assertCurrent?.()
      const committed = await findNativeAccountById<User>(req, settings.collection, account.id)
      if (!committed) throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_NOT_FOUND')
      if (committed.email !== identity.email)
        throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_EMAIL_CHANGED')
      if (committed._verified !== true)
        throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_NOT_VERIFIED')
      if (committed.deletedAt) throw new AuthFailure('AUTH_FAILED', 401, 'ACCOUNT_UNAVAILABLE')
      if (
        committed.hash != null ||
        committed.salt != null ||
        (committed.sessions as unknown[] | undefined)?.length
      )
        throw new AuthFailure('AUTH_FAILED', 401, 'PUBLIC_ACCOUNT_STATE_INVALID')
      return { account: committed }
    })
  } finally {
    req.user = original
  }
}
