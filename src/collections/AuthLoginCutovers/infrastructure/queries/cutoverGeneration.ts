import { AuthFailure } from '../../../../shared/contracts/errors'
import type { PayloadRequest } from 'payload'
import type { DrizzleDatabase } from '../../../../shared/infrastructure/payload/nativeTransaction'
/** Internal durable state: no public CRUD surface; missing state is baseline, not a read-error fallback. */
export async function readCutoverGeneration(
  req: PayloadRequest,
  collection: string,
): Promise<string> {
  try {
    const db = req.payload.db as unknown as DrizzleDatabase
    if (!['sqlite', 'postgres'].includes(db.name)) throw new Error('AUTH_STORAGE_UNAVAILABLE')
    // Payload falls back to its default connection for stale transaction IDs. Fail closed
    // rather than read outside the caller's transaction.
    if (req.transactionID && !db.sessions[String(await req.transactionID)]?.db)
      throw new Error('AUTH_STORAGE_UNAVAILABLE')
    const record = await req.payload.db.findOne<{ id: string | number; generation: string }>({
      collection: 'auth-login-cutovers',
      req,
      select: { generation: true },
      where: { collection: { equals: collection } },
    })
    const generation = record?.generation ?? ''
    if (record && !/^[a-f0-9]{64}$/.test(generation)) throw new Error('AUTH_STORAGE_UNAVAILABLE')
    return generation
  } catch {
    // Native schema/query availability precedes the OTP flow's own storage boundary.
    // Never downgrade infrastructure failure to invalid credentials or a baseline epoch.
    throw new AuthFailure('AUTH_UNAVAILABLE', 503)
  }
}
