import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { AuthFailure } from '../contracts/errors'
interface Intent {
  password: string
  email: string
  native?: { hash: string; salt: string }
}
const intents = new WeakMap<PayloadRequest, Intent>()
/** Request-private intent is armed only by the credential commit, never by transport/context. */
export function beginCredentialIntent(req: PayloadRequest, email: string, password: string) {
  if (intents.has(req)) throw new AuthFailure('AUTH_FAILED', 401)
  intents.set(req, { email, password })
}
export function clearCredentialIntent(req: PayloadRequest) {
  intents.delete(req)
}
/** Last collection beforeChange hook: a host cannot replace the owner's chosen password. */
export const guardCredentialIntent: CollectionBeforeChangeHook = ({ req, data }) => {
  const intent = intents.get(req)
  if (
    intent &&
    (data.password !== intent.password || (data.email !== undefined && data.email !== intent.email))
  )
    throw new AuthFailure('AUTH_FAILED', 401)
  return data
}
/** Capture the first native hash/salt write before afterChange hooks can substitute it. */
export function observeCredentialWrite(
  req: PayloadRequest | undefined,
  data: Record<string, unknown>,
) {
  const intent = req ? intents.get(req) : undefined
  if (
    intent &&
    !intent.native &&
    typeof data.hash === 'string' &&
    data.hash &&
    typeof data.salt === 'string' &&
    data.salt
  )
    intent.native = { hash: data.hash, salt: data.salt }
}
export function assertCredentialIntent(
  req: PayloadRequest,
  record: Record<string, unknown> | null,
  id: string | number,
) {
  const intent = intents.get(req)
  if (
    !intent?.native ||
    !record ||
    record.id !== id ||
    record.email !== intent.email ||
    record._verified !== true ||
    record.deletedAt ||
    record.hash !== intent.native.hash ||
    record.salt !== intent.native.salt
  )
    throw new AuthFailure('AUTH_FAILED', 401)
}
