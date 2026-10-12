import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'
import type { DrizzleDatabase } from '../../../../shared/infrastructure/payload/nativeTransaction'

/** Strict create: any identity or account/provider uniqueness collision aborts the caller transaction. */
export async function insertIdentityAssociation(
  req: PayloadRequest,
  collection: string,
  provider: string,
  subject: string,
  account: string,
): Promise<void> {
  const db = req.payload.db as unknown as DrizzleDatabase
  // Payload otherwise falls back to its default connection for absent/stale sessions.
  if (!req.transactionID || !db.sessions[String(await req.transactionID)]?.db)
    throw new Error('AUTH_STORAGE_UNAVAILABLE')
  await req.payload.db.create({
    collection: 'auth-login-identities',
    data: { collection, provider, subject, account },
    req,
    returning: false,
  })
}

/** Reserve without replacing the winning subject association; caller rereads and checks ownership. */
export async function associateIdentityIfAbsent(
  req: PayloadRequest,
  collection: string,
  provider: string,
  subject: string,
  account: string,
  db: DrizzleDatabase,
): Promise<void> {
  // Payload's db API cannot ignore only this conflict target. Catching a create error
  // would also abort PostgreSQL's transaction or hide an account/provider collision.
  await db.execute({
    db: db.sessions[String(await req.transactionID)].db,
    sql: sql`INSERT INTO auth_login_identities (collection, provider, subject, account) VALUES (${collection}, ${provider}, ${subject}, ${account}) ON CONFLICT (collection, provider, subject) DO NOTHING`,
  })
}
