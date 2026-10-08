import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { AuthFailure } from '../contracts/errors'
interface Intent {
  password: string
  email: string
  native?: { hash: string; salt: string }
  capability: object
  payload: PayloadRequest['payload']
  headers: PayloadRequest['headers']
  transactionID: PayloadRequest['transactionID']
}
const intents = new WeakMap<PayloadRequest, Intent>()
const capabilityKey = Symbol('auth-login/credential-intent')
const owners = new WeakMap<object, PayloadRequest>()
type IntentRequest = PayloadRequest & { [capabilityKey]?: object }
/** Transparent native operation proxies preserve this private, non-enumerable capability.
 * HTTP/context fields and ordinary request copies cannot manufacture or copy it.
 */
export function getCredentialIntentRequest(req: PayloadRequest): PayloadRequest | undefined {
  const capability = (req as IntentRequest)[capabilityKey]
  const owner = capability ? owners.get(capability) : undefined
  const intent = owner ? intents.get(owner) : undefined
  if (
    !intent ||
    req.payload !== intent.payload ||
    req.headers !== intent.headers ||
    req.transactionID !== intent.transactionID ||
    (req !== owner && (typeof intent.transactionID !== 'string' || !intent.transactionID))
  )
    return undefined
  return owner
}
function intentFor(req: PayloadRequest): Intent | undefined {
  const owner = getCredentialIntentRequest(req)
  return owner ? intents.get(owner) : undefined
}
/** Request-private intent is armed only by the credential commit, never by transport/context. */
export function beginCredentialIntent(req: PayloadRequest, email: string, password: string) {
  if (intents.has(req) || intentFor(req)) throw new AuthFailure('AUTH_FAILED', 401)
  const capability = {}
  Object.defineProperty(req, capabilityKey, { value: capability, configurable: true })
  owners.set(capability, req)
  intents.set(req, {
    email,
    password,
    capability,
    payload: req.payload,
    headers: req.headers,
    transactionID: req.transactionID,
  })
}
export function clearCredentialIntent(req: PayloadRequest) {
  // Cleanup uses the original owner, even if a host hook changed request bindings.
  const intent = intents.get(req)
  if (intent) owners.delete(intent.capability)
  delete (req as IntentRequest)[capabilityKey]
  intents.delete(req)
}
/** Last collection beforeChange hook: a host cannot replace the owner's chosen password. */
export const guardCredentialIntent: CollectionBeforeChangeHook = ({ req, data }) => {
  const intent = intentFor(req)
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
  const intent = req ? intentFor(req) : undefined
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
  const intent = intentFor(req)
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
