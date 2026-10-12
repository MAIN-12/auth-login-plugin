import { sql } from 'drizzle-orm'
import type { DrizzleDatabase } from '../../../../shared/infrastructure/payload/nativeTransaction'
/** Acquire only; the authenticated-user caller owns the transaction and commit. */
export async function acquireCredentialLock(
  db: DrizzleDatabase,
  tx: unknown,
  key: string,
): Promise<void> {
  await db.execute({
    db: tx,
    sql: sql`INSERT INTO auth_login_credential_locks (key) VALUES (${key}) ON CONFLICT (key) DO NOTHING`,
  })
  if (db.name === 'postgres')
    await db.execute({
      db: tx,
      sql: sql`SELECT key FROM auth_login_credential_locks WHERE key = ${key} FOR UPDATE`,
    })
}
