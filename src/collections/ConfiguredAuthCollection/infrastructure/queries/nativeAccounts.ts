import type { Payload, PayloadRequest } from 'payload'
type NativeUser = NonNullable<PayloadRequest['user']>
type Select = Parameters<Payload['db']['findOne']>[0]['select']
/** Native auth evidence includes hidden hash/salt/session fields. Local API would apply
 * presentation hooks/read filtering and is not equivalent here. Reuse the original req
 * so native coordination and the caller's transaction remain authoritative.
 */
export function findNativeAccountById<T extends { id: string | number } = NativeUser>(
  req: PayloadRequest,
  collection: string,
  id: string | number,
  select?: Select,
) {
  return req.payload.db.findOne<T>({
    collection,
    req,
    where: { id: { equals: id } },
    ...(select ? { select } : {}),
  })
}
export function findNativeAccountByEmail<T extends { id: string | number } = NativeUser>(
  req: PayloadRequest,
  collection: string,
  email: string,
  select?: Select,
) {
  return req.payload.db.findOne<T>({
    collection,
    req,
    where: { email: { equals: email } },
    ...(select ? { select } : {}),
  })
}
