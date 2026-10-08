import { AuthOperationFailure } from './errors'
import type { GoogleIdentity, GoogleCorrelation } from './google'
import type { PasswordPermit } from './passwordPermit'
interface Account {
  id: string | number
  verified: boolean
  deleted: boolean
}
/** Account policy is independent of Payload: stable identity, closed signup, no email autolink.
 * Adapter snapshots are obtained under the native transaction; the application grants an intent,
 * not permission to bypass native lockout, access, hooks, session or uniqueness checks.
 */
export function authorizeGoogleAccount(input: {
  purpose: 'login'
  signup: boolean
  linked: Account | null
  emailAccountExists: boolean
  identity: GoogleIdentity
}): 'existing' | 'provision' {
  if (input.linked) {
    if (!input.linked.verified || input.linked.deleted)
      throw new AuthOperationFailure('AUTH_FAILED')
    return 'existing'
  }
  if (
    !input.signup ||
    input.emailAccountExists ||
    !input.identity.emailVerified ||
    !input.identity.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.identity.email)
  )
    throw new AuthOperationFailure('AUTH_FAILED')
  return 'provision'
}

/** Selected native evidence is re-read under locks; decoding alone is never permission. */
export function authorizeGooglePrincipal(input: {
  principal: GoogleCorrelation['principal']
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
    throw new AuthOperationFailure('AUTH_FAILED')
}
export function authorizeGoogleLink(
  principal: NonNullable<GoogleCorrelation['principal']>,
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
    throw new AuthOperationFailure('AUTH_FAILED')
}
export function authorizeGoogleReauthentication(
  principal: NonNullable<GoogleCorrelation['principal']>,
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
    throw new AuthOperationFailure('AUTH_FAILED')
}
