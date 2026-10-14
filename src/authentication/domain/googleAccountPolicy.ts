import { AuthOperationFailure } from '../../shared/domain/errors'
import type { GoogleIdentity, GooglePrincipal } from './google'
import type { PasswordPermit } from '../../collections/AuthLoginPasswordPermits/domain'
interface Account {
  id: string | number
  verified: boolean
  deleted: boolean
}
/** Account policy is independent of Payload: stable identity, closed signup, authoritative email association.
 * Adapter snapshots are obtained under the native transaction; the application grants an intent,
 * not permission to bypass native lockout, access, hooks, session or uniqueness checks.
 */
export function authorizeGoogleAccount(input: {
  purpose: 'login'
  signup: boolean
  linked: Account | null
  emailAccount: Account | null
  identity: GoogleIdentity
}): 'existing' | 'associate' | 'provision' {
  if (input.linked) {
    if (input.linked.deleted) throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_UNAVAILABLE')
    if (!input.linked.verified)
      throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_NOT_VERIFIED')
    return 'existing'
  }
  if (input.emailAccount) {
    // An external/unverified email claim cannot reveal local verification or deletion state.
    if (!googleHasEmailAuthority(input.identity))
      throw new AuthOperationFailure(
        'AUTH_FAILED',
        input.identity.emailVerified ? 'GOOGLE_LINK_REQUIRED' : 'GOOGLE_EMAIL_UNVERIFIED',
      )
    if (input.emailAccount.deleted)
      throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_UNAVAILABLE')
    if (!input.emailAccount.verified)
      throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_NOT_VERIFIED')
    return 'associate'
  }
  if (!input.signup) throw new AuthOperationFailure('AUTH_FAILED', 'SIGNUP_DISABLED')
  if (!input.identity.emailVerified)
    throw new AuthOperationFailure('AUTH_FAILED', 'GOOGLE_EMAIL_UNVERIFIED')
  if (!input.identity.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.identity.email))
    throw new AuthOperationFailure('AUTH_FAILED', 'GOOGLE_IDENTITY_REJECTED')
  return 'provision'
}

/** Google is authoritative for Gmail or verified Workspace, not an external email claim alone. */
export function googleHasEmailAuthority(identity: GoogleIdentity): boolean {
  if (
    !identity.emailVerified ||
    !identity.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)
  )
    return false
  return (
    identity.email.toLowerCase().endsWith('@gmail.com') ||
    (typeof identity.hostedDomain === 'string' &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(identity.hostedDomain))
  )
}

/** Selected native evidence is re-read under locks; decoding alone is never permission. */
export function authorizeGooglePrincipal(input: {
  principal: GooglePrincipal | undefined
  current: {
    id: string | number
    sid: string
    version: string
    email: string
    verified: boolean
    deleted: boolean
    sessionActive: boolean
  } | null
}) {
  const { principal, current } = input
  if (
    !principal ||
    !current ||
    principal.id !== current.id ||
    principal.sid !== current.sid ||
    principal.version !== current.version ||
    principal.email !== current.email ||
    !current.verified ||
    current.deleted ||
    !current.sessionActive
  )
    throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_STATE_CHANGED')
}
export function authorizeGoogleLink(
  principal: GooglePrincipal,
  permit: PasswordPermit,
  linkedID?: string | number,
) {
  if (
    permit.purpose !== 'reauth' ||
    permit.account !== principal.id ||
    permit.sid !== principal.sid ||
    permit.email !== principal.email ||
    permit.version !== principal.version ||
    !permit.nonce ||
    (linkedID !== undefined && String(linkedID) !== String(principal.id))
  )
    throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_STATE_CHANGED')
}
export function authorizeGoogleReauthentication(
  principal: GooglePrincipal,
  linkedID: string | number | undefined,
  identity: GoogleIdentity,
  now: number,
) {
  if (
    linkedID === undefined ||
    String(linkedID) !== String(principal.id) ||
    identity.authenticatedAt === undefined ||
    !Number.isFinite(identity.authenticatedAt) ||
    identity.authenticatedAt < now - 300_000 ||
    identity.authenticatedAt > now + 30_000
  )
    throw new AuthOperationFailure('AUTH_FAILED', 'ACCOUNT_STATE_CHANGED')
}
