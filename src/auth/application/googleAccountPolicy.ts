import { AuthFailure } from '../domain/login'
import type { GoogleIdentity } from './googleFlow'
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
    if (!input.linked.verified || input.linked.deleted) throw new AuthFailure('AUTH_FAILED', 401)
    return 'existing'
  }
  if (
    !input.signup ||
    input.emailAccountExists ||
    !input.identity.emailVerified ||
    !input.identity.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.identity.email)
  )
    throw new AuthFailure('AUTH_FAILED', 401)
  return 'provision'
}
